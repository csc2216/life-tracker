import { describe, expect, it } from 'vitest';
import { pairEvents } from './pairing';
import type { EventType, LogEvent } from '../db/types';
import { HOUR } from './time';

const T0 = new Date(2026, 10, 20, 23, 30).getTime(); // 11/20 23:30 local
let n = 0;
const ev = (type: EventType, ts: number, note?: string): LogEvent => ({ id: `e${n++}`, type, timestamp: ts, note });

describe('pairEvents', () => {
  it('pairs sleep and wake across midnight', () => {
    const s = ev('sleep', T0);
    const w = ev('wake', T0 + 7.5 * HOUR);
    const r = pairEvents([w, s], T0 + 10 * HOUR);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].end! - r.segments[0].start).toBe(7.5 * HOUR);
    expect(r.unpairedIds.size).toBe(0);
    expect(r.segmentByEventId.get(w.id)).toBe(r.segments[0]);
  });

  it('marks the earlier of two consecutive sleeps as unpaired', () => {
    const s1 = ev('sleep', T0);
    const s2 = ev('sleep', T0 + HOUR);
    const w = ev('wake', T0 + 8 * HOUR);
    const r = pairEvents([s1, s2, w], T0 + 9 * HOUR);
    expect([...r.unpairedIds]).toEqual([s1.id]);
    expect(r.segments[0].startId).toBe(s2.id);
  });

  it('marks orphan wake as unpaired', () => {
    const w = ev('wake', T0);
    const r = pairEvents([w], T0 + HOUR);
    expect(r.unpairedIds.has(w.id)).toBe(true);
    expect(r.segments).toHaveLength(0);
  });

  it('treats recent trailing sleep as ongoing, old one as unpaired', () => {
    const s = ev('sleep', T0);
    expect(pairEvents([s], T0 + 2 * HOUR).ongoingSleep?.startId).toBe(s.id);
    const old = pairEvents([s], T0 + 30 * HOUR);
    expect(old.ongoingSleep).toBeUndefined();
    expect(old.unpairedIds.has(s.id)).toBe(true);
  });

  it('detects ongoing exercise and carries note', () => {
    const a = ev('exercise_start', T0 - 5 * HOUR, '跑步');
    const b = ev('exercise_end', T0 - 4 * HOUR);
    const c = ev('exercise_start', T0, '重訓');
    const r = pairEvents([a, b, c], T0 + HOUR);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].note).toBe('跑步');
    expect(r.ongoingExercise?.startId).toBe(c.id);
    expect(r.ongoingExercise?.note).toBe('重訓');
    expect(r.unpairedIds.size).toBe(0);
  });

  it('re-pairs correctly after a timestamp edit changes order', () => {
    const s = ev('sleep', T0);
    const w = ev('wake', T0 + 7 * HOUR);
    // user mistakenly edited wake to before sleep
    const edited = { ...w, timestamp: T0 - HOUR };
    const r = pairEvents([s, edited], T0 + 8 * HOUR);
    expect(r.unpairedIds.has(edited.id)).toBe(true);
    expect(r.ongoingSleep?.startId).toBe(s.id);
  });

  it('keeps sleep and exercise independent', () => {
    const s = ev('sleep', T0);
    const x = ev('exercise_start', T0 + HOUR);
    const y = ev('exercise_end', T0 + 2 * HOUR);
    const w = ev('wake', T0 + 8 * HOUR);
    const r = pairEvents([s, x, y, w], T0 + 9 * HOUR);
    expect(r.segments.map((g) => g.kind)).toEqual(['sleep', 'exercise']);
    expect(r.unpairedIds.size).toBe(0);
  });
});
