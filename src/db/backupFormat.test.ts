import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, parseBackup } from './backupFormat';

const ev = { id: 'a', type: 'sleep', timestamp: 1_700_000_000_000 };

describe('parseBackup', () => {
  it('accepts a current-version file and drops device-local fields', () => {
    const r = parseBackup(
      JSON.stringify({
        app: 'life-tracker',
        version: 4,
        appVersion: '0.1.0',
        exportedAt: 5,
        events: [ev],
        cards: [],
        settings: { id: 'main', exerciseTypes: ['跑步'], lastExportedAt: 123 },
      }),
    );
    expect(r.fromVersion).toBe(4);
    expect(r.events).toEqual([ev]);
    expect(r.settings).toEqual({ exerciseTypes: ['跑步'] });
    expect(r.appVersion).toBe('0.1.0');
  });

  it('converts v1 exercise minutes to hours', () => {
    const base = { app: 'life-tracker', version: 1, events: [], cards: [] };
    expect(parseBackup(JSON.stringify({ ...base, settings: { exerciseTargetMinutes: 150 } })).settings).toEqual({ exerciseTargetHours: 7 });
    expect(parseBackup(JSON.stringify({ ...base, settings: { exerciseTargetMinutes: 90 } })).settings).toEqual({ exerciseTargetHours: 1.5 });
  });

  it('v2 → v3 splits finished sub-tasks out of projects', () => {
    const r = parseBackup(
      JSON.stringify({
        app: 'life-tracker',
        version: 2,
        events: [],
        cards: [{ id: 'p', kind: 'project', column: 'short', order: 0, title: '搬家', tasks: [{ id: 'a', title: '打包', done: true }, { id: 'b', title: '叫車', done: false }] }],
      }),
    );
    expect(r.cards).toHaveLength(2);
    const done = r.cards.find((c) => c.column === 'done')!;
    expect(done).toMatchObject({ kind: 'single', title: '打包', fromProject: { id: 'p', title: '搬家' }, prevColumn: 'short' });
    expect(r.cards.find((c) => c.id === 'p')!.tasks.map((t) => t.id)).toEqual(['b']);
  });

  it('v3 → v4 adds an empty photo list', () => {
    const r = parseBackup(JSON.stringify({ app: 'life-tracker', version: 3, events: [], cards: [] }));
    expect(r.images).toEqual([]);
    expect(r.skippedImages).toBe(0);
  });

  it('keeps valid photos and skips bad ones', () => {
    const good = { id: 'meal', dataUrl: 'data:image/jpeg;base64,AAAA', updatedAt: 1 };
    const r = parseBackup(
      JSON.stringify({
        app: 'life-tracker',
        version: 4,
        events: [],
        cards: [],
        images: [good, { id: 'meal', dataUrl: 'https://evil.example/x.png' }, { id: 'nap', dataUrl: 'data:image/png;base64,AA' }, { id: 'wake', dataUrl: 'data:image/png;base64,' + 'A'.repeat(1_000_001) }],
      }),
    );
    expect(r.images).toEqual([good]);
    expect(r.skippedImages).toBe(3);
  });

  it('migrates a v0 bare events array', () => {
    const r = parseBackup(JSON.stringify([ev, { id: 'b', type: 'wake', timestamp: '2026-11-20T07:00:00Z' }]));
    expect(r.fromVersion).toBe(0);
    expect(r.version).toBe(BACKUP_VERSION);
    expect(r.events).toHaveLength(2);
    expect(r.events[1].timestamp).toBe(Date.parse('2026-11-20T07:00:00Z'));
    expect(r.cards).toEqual([]);
  });

  it('migrates a v0 object without version / cards / settings', () => {
    const r = parseBackup(JSON.stringify({ events: [ev] }));
    expect(r.fromVersion).toBe(0);
    expect(r.events).toEqual([ev]);
    expect(r.settings).toEqual({});
  });

  it('rejects files from a newer app', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'life-tracker', version: 99, events: [] }))).toThrow(/較新的 App/);
  });

  it('gives clear errors for bad input', () => {
    expect(() => parseBackup('not json')).toThrow('不是有效的 JSON 檔案');
    expect(() => parseBackup(JSON.stringify({ app: 'other', version: 1, events: [] }))).toThrow(/不是 Life Tracker/);
    expect(() => parseBackup(JSON.stringify({ foo: 1 }))).toThrow(/不是 Life Tracker/);
    expect(() => parseBackup(JSON.stringify([{ id: 'x', type: 'nap', timestamp: 1 }]))).toThrow('第 1 筆紀錄格式錯誤');
  });
});
