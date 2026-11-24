/*
 * Pure backup-file format: versioning, migration of old formats, validation.
 * No Dexie import here so it can be unit-tested in node.
 *
 * When the export format changes:
 *   1. bump BACKUP_VERSION
 *   2. add MIGRATORS[oldVersion] that converts oldVersion → oldVersion + 1
 *   Never edit an existing migrator — old files on people's phones depend on it.
 */
import { EVENT_TYPES, QUICK_BUTTON_IDS, type ButtonImage, type Card, type LogEvent, type QuickButtonId, type Settings } from './types';
import { settingsV1toV2, splitDoneSubtasks } from './migrations';
import { newId } from '../lib/id';

export const BACKUP_VERSION = 4;
/** Largest photo accepted from a backup file (data URL length). */
export const MAX_IMAGE_CHARS = 1_000_000;

export interface BackupFile {
  app: 'life-tracker';
  version: typeof BACKUP_VERSION;
  appVersion?: string;
  exportedAt: number;
  events: LogEvent[];
  cards: Card[];
  /** Partial: missing fields fall back to defaults when imported. */
  settings: Partial<Settings>;
  images: ButtonImage[];
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * v0 = files from before versioning existed: either a bare array of events,
 * or an object with events/cards/settings but no `version`.
 */
const MIGRATORS: Record<number, (raw: unknown) => Raw> = {
  0: (raw) => {
    const obj: Raw = Array.isArray(raw) ? { events: raw } : (raw as Raw);
    return {
      app: 'life-tracker',
      version: 1,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : 0,
      events: obj.events ?? [],
      cards: obj.cards ?? [],
      settings: obj.settings ?? {},
    };
  },
  1: (raw) => {
    const obj = raw as Raw;
    return { ...obj, version: 2, settings: isObj(obj.settings) ? settingsV1toV2(obj.settings) : {} };
  },
  2: (raw) => {
    const obj = raw as Raw;
    const cards = Array.isArray(obj.cards) ? obj.cards.filter(isObj) : [];
    return { ...obj, version: 3, cards: splitDoneSubtasks(cards, newId, Date.now()) };
  },
  3: (raw) => ({ ...(raw as Raw), version: 4, images: [] }),
};

function detectVersion(raw: unknown): number {
  if (Array.isArray(raw)) return 0;
  if (!isObj(raw)) throw new Error('備份檔內容不是物件');
  if (raw.app !== undefined && raw.app !== 'life-tracker') throw new Error('這不是 Life Tracker 的備份檔');
  if (raw.version === undefined) {
    if (!Array.isArray(raw.events)) throw new Error('這不是 Life Tracker 的備份檔');
    return 0;
  }
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 0) {
    throw new Error(`無法辨識的備份版本：${String(raw.version)}`);
  }
  return raw.version;
}

/** Upgrade any supported older format to the current one, step by step. */
export function migrateBackup(raw: unknown): { data: Raw; fromVersion: number } {
  const fromVersion = detectVersion(raw);
  if (fromVersion > BACKUP_VERSION) {
    throw new Error(`這份備份來自較新的 App（格式 v${fromVersion}），請先更新 App 再匯入`);
  }
  let cur: unknown = raw;
  for (let v = fromVersion; v < BACKUP_VERSION; v++) {
    const step = MIGRATORS[v];
    if (!step) throw new Error(`缺少 v${v} → v${v + 1} 的轉換`);
    cur = step(cur);
  }
  return { data: cur as Raw, fromVersion };
}

function toTimestamp(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return undefined;
}

/** Bad photos are skipped (and counted) rather than failing the whole import. */
function validImages(raw: unknown): { images: ButtonImage[]; skipped: number } {
  const list = Array.isArray(raw) ? raw : [];
  const images: ButtonImage[] = [];
  for (const x of list) {
    if (
      isObj(x) &&
      QUICK_BUTTON_IDS.includes(x.id as QuickButtonId) &&
      typeof x.dataUrl === 'string' &&
      x.dataUrl.startsWith('data:image/') &&
      x.dataUrl.length <= MAX_IMAGE_CHARS
    ) {
      images.push({ id: x.id as QuickButtonId, dataUrl: x.dataUrl, updatedAt: typeof x.updatedAt === 'number' ? x.updatedAt : 0 });
    }
  }
  return { images, skipped: list.length - images.length };
}

function validate(data: Raw): BackupFile & { skippedImages: number } {
  if (!Array.isArray(data.events)) throw new Error('備份缺少 events');

  const events: LogEvent[] = data.events.map((e, i) => {
    const ts = isObj(e) ? toTimestamp(e.timestamp) : undefined;
    if (!isObj(e) || typeof e.id !== 'string' || !EVENT_TYPES.includes(e.type as LogEvent['type']) || ts === undefined) {
      throw new Error(`第 ${i + 1} 筆紀錄格式錯誤`);
    }
    return {
      id: e.id,
      type: e.type as LogEvent['type'],
      timestamp: ts,
      ...(typeof e.note === 'string' && e.note ? { note: e.note } : {}),
    };
  });

  const cardsRaw = data.cards ?? [];
  if (!Array.isArray(cardsRaw)) throw new Error('cards 格式錯誤');
  const cards = cardsRaw.map((c, i) => {
    if (!isObj(c) || typeof c.id !== 'string' || typeof c.title !== 'string') {
      throw new Error(`第 ${i + 1} 張卡片格式錯誤`);
    }
    return { tasks: [], ...c } as unknown as Card;
  });

  const { images, skipped: skippedImages } = validImages(data.images);

  // lastExportedAt is device-local and never imported.
  const { lastExportedAt: _ignored, id: _id, ...settings } = (isObj(data.settings) ? data.settings : {}) as Partial<Settings>;
  void _ignored;
  void _id;

  return {
    app: 'life-tracker',
    version: BACKUP_VERSION,
    appVersion: typeof data.appVersion === 'string' ? data.appVersion : undefined,
    exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : 0,
    events,
    cards,
    settings,
    images,
    skippedImages,
  };
}

/** Parse, migrate and validate; throws Error with a user-facing (Chinese) message. */
export function parseBackup(text: string): BackupFile & { fromVersion: number; skippedImages: number } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('不是有效的 JSON 檔案');
  }
  const { data, fromVersion } = migrateBackup(raw);
  return { ...validate(data), fromVersion };
}
