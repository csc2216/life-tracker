import { db, DEFAULT_SETTINGS, updateSettings } from './db';
import { BACKUP_VERSION, type BackupFile } from './backupFormat';
import { dateKey } from '../lib/time';

export { parseBackup, type BackupFile } from './backupFormat';

export async function buildBackup(): Promise<BackupFile> {
  const [events, cards, settings, images] = await Promise.all([
    db.events.orderBy('timestamp').toArray(),
    db.cards.toArray(),
    db.settings.get('main'),
    db.images.toArray(),
  ]);
  const { lastExportedAt: _local, ...rest } = { ...DEFAULT_SETTINGS, ...settings };
  void _local;
  return {
    app: 'life-tracker',
    version: BACKUP_VERSION,
    appVersion: __APP_VERSION__,
    exportedAt: Date.now(),
    events,
    cards,
    settings: rest,
    images,
  };
}

/** Returns true if the file was handed off (downloaded or shared). */
export async function exportBackup(): Promise<boolean> {
  const data = await buildBackup();
  const name = `life-tracker-${dateKey(Date.now()).replaceAll('-', '')}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });

  // iOS standalone PWAs ignore <a download>; use the share sheet there.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  let done = false;
  if (isIOS && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      done = true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  if (!done) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  await updateSettings({ lastExportedAt: data.exportedAt });
  return true;
}

export async function importBackup(data: BackupFile, mode: 'replace' | 'merge') {
  await db.transaction('rw', [db.events, db.cards, db.settings, db.images], async () => {
    const cur = { ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) };
    if (mode === 'replace') {
      await Promise.all([db.events.clear(), db.cards.clear(), db.images.clear()]);
      await db.settings.put({ ...DEFAULT_SETTINGS, ...data.settings, id: 'main', lastExportedAt: cur.lastExportedAt });
    } else {
      const types = [...cur.exerciseTypes];
      for (const t of data.settings.exerciseTypes ?? []) if (!types.includes(t)) types.push(t);
      await db.settings.put({ ...cur, exerciseTypes: types });
    }
    await db.events.bulkPut(data.events);
    await db.cards.bulkPut(data.cards);
    await db.images.bulkPut(data.images);
  });
}

export async function clearAll() {
  await db.transaction('rw', [db.events, db.cards, db.settings, db.images], async () => {
    await Promise.all([db.events.clear(), db.cards.clear(), db.settings.clear(), db.images.clear()]);
  });
}
