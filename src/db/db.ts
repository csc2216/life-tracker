import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ButtonImage, Card, LogEvent, Settings } from './types';
import { settingsV1toV2, splitDoneSubtasks } from './migrations';
import { newId } from '../lib/id';

/*
 * ──────────────── SCHEMA 規則（資料安全） ────────────────
 * 1. 已發佈的 version(n) 永遠不刪、不改。
 * 2. 要改資料結構（新增表、新增/修改索引、欄位改名或改格式）時：
 *    新增 version(n+1)，並在 .upgrade() 裡把舊資料轉成新格式。
 * 3. 任何 upgrade 都不得 clear() 或刪表來「重來」。
 * 4. 只新增「非索引」欄位（例如 Settings.lastExportedAt）不需要新版本，
 *    但讀取時要能處理欄位不存在的舊資料。
 * 5. 若同時改了匯出格式，記得在 backupFormat.ts 加對應的 migrator。
 *
 * 範例（日後照抄）：
 *   this.version(2)
 *     .stores({ events: 'id, type, timestamp, [type+timestamp]' })
 *     .upgrade(async (tx) => {
 *       await tx.table('events').toCollection().modify((e) => {
 *         // 例如：把舊欄位轉成新欄位
 *       });
 *     });
 */
export const DB_NAME = 'life-tracker';

class LifeDB extends Dexie {
  events!: Table<LogEvent, string>;
  cards!: Table<Card, string>;
  settings!: Table<Settings, string>;
  images!: Table<ButtonImage, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      events: 'id, type, timestamp',
      cards: 'id, column, order',
      settings: 'id',
    });
    // v2: Settings.exerciseTargetMinutes → exerciseTargetHours (no index changes)
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const rows = await tx.table('settings').toArray();
        for (const row of rows) await tx.table('settings').put(settingsV1toV2(row));
      });
    // v3: finished project sub-tasks become their own Done cards (Card.fromProject)
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        const cards = await tx.table('cards').toArray();
        await tx.table('cards').bulkPut(splitDoneSubtasks(cards, newId, Date.now()));
      });
    // v4: new table for the photos on the four quick buttons (no data to convert)
    this.version(4).stores({ images: 'id' });
  }
}

export const db = new LifeDB();

/** Set when another tab opened a newer schema; UI asks the user to reload. */
export const dbStatus = {
  blockedByNewerVersion: false,
  listeners: new Set<() => void>(),
  notify() {
    this.listeners.forEach((l) => l());
  },
};

// Another tab (a newer app version) wants to upgrade the schema: close our
// connection so its upgrade can proceed, then ask the user to reload.
db.on('versionchange', () => {
  db.close();
  dbStatus.blockedByNewerVersion = true;
  dbStatus.notify();
  return false;
});

/** Ask the browser not to evict our storage (helps on iOS / low disk). */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  try {
    if (!navigator.storage?.persist) return undefined;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return undefined;
  }
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  sleepTargetHours: 7.5,
  sleepStdDevMinutes: 90,
  exerciseTargetHours: 7,
  exerciseTypes: ['跑步', '重訓', '游泳', '騎車', '走路', '瑜伽'],
  theme: 'clean',
};

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('main'));
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>) {
  await db.transaction('rw', db.settings, async () => {
    const cur = await db.settings.get('main');
    await db.settings.put({ ...DEFAULT_SETTINGS, ...cur, ...patch, id: 'main' });
  });
}

export async function addExerciseType(name: string) {
  const t = name.trim();
  if (!t) return;
  const cur = { ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) };
  if (!cur.exerciseTypes.includes(t)) {
    await updateSettings({ exerciseTypes: [...cur.exerciseTypes, t] });
  }
}
