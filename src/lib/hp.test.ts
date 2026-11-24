import { describe, expect, it } from 'vitest';
import {
  circularStats,
  computeExerciseHp,
  computeSleepHp,
  dailyExercise,
  dailySleep,
  formatHours,
  hpLevel,
  sleepDayKey,
} from './hp';
import type { Segment } from './pairing';
import { HOUR, MINUTE } from './time';

const T = { sleepTargetHours: 7.5, sleepStdDevMinutes: 90, exerciseTargetHours: 7 };
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const sleep = (start: number, hours: number): Segment => ({ kind: 'sleep', startId: 's' + start, endId: 'e' + start, start, end: start + hours * HOUR });
const ex = (start: number, mins: number): Segment => ({ kind: 'exercise', startId: 'x' + start, endId: 'y' + start, start, end: start + mins * MINUTE });
const NOW = at(24, 20);

describe('sleep day', () => {
  it('belongs to the wake-up day, boundary 18:00', () => {
    expect(sleepDayKey(at(24, 7))).toBe('2026-11-24'); // 23:00→07:00
    expect(sleepDayKey(at(24, 9))).toBe('2026-11-24'); // 06:00→09:00
    expect(sleepDayKey(at(24, 14))).toBe('2026-11-24'); // 03:00→14:00
    expect(sleepDayKey(at(24, 19, 30))).toBe('2026-11-25'); // evening nap → next day
  });

  it('handles 06:00→09:00 and 03:00→14:00 sessions', () => {
    const d = dailySleep([sleep(at(23, 6), 3), sleep(at(24, 3), 11)], NOW);
    expect(d[5]).toMatchObject({ key: '2026-11-23', minutes: 180, detail: '06:00–09:00' });
    expect(d[6]).toMatchObject({ key: '2026-11-24', minutes: 660, detail: '03:00–14:00' });
  });

  it('sums naps into the day but keeps the main sleep for onset', () => {
    const d = dailySleep([sleep(at(23, 23), 7), sleep(at(24, 15), 1)], NOW);
    expect(d[6]).toMatchObject({ minutes: 480, detail: '23:00–06:00 ＋1 段小睡' });
  });
});

describe('circularStats', () => {
  it('averages across midnight', () => {
    const r = circularStats([23 * 60, 60]);
    expect(Math.min(r.mean, 1440 - r.mean)).toBeLessThan(1); // ≈ 00:00
    expect(r.sd).toBeCloseTo(60, 0);
  });
  it('treats 03:00 vs 13:00 as 10 h apart', () => {
    expect(circularStats([180, 780, 180, 780]).sd).toBeGreaterThan(300);
  });
  it('is 0 for identical times', () => {
    expect(circularStats([600, 600, 600]).sd).toBeCloseTo(0);
  });
});

describe('computeSleepHp', () => {
  it('is 0 with no data', () => {
    expect(computeSleepHp([], NOW, T).hp).toBe(0);
  });

  it('is 100% for 7.5h every night at the same time', () => {
    const segs = [17, 18, 19, 20, 21, 22, 23].map((d) => sleep(at(d, 23), 7.5));
    expect(computeSleepHp(segs, NOW, T).hp).toBeCloseTo(1);
  });

  it('a consistently late schedule (03:00→10:30) is still fully regular', () => {
    const segs = [18, 19, 20, 21, 22, 23, 24].map((d) => sleep(at(d, 3), 7.5));
    const r = computeSleepHp(segs, NOW, T);
    expect(r.days).toBe(7);
    expect(r.regularity).toBeCloseTo(1);
    expect(r.hp).toBeCloseTo(1);
  });

  it('23:00 vs 01:00 onsets are 1 h SD, not 11 h', () => {
    const r = computeSleepHp([sleep(at(22, 23), 7.5), sleep(at(24, 1), 7.5)], NOW, T);
    expect(r.sdMinutes).toBeCloseTo(60, 0);
  });

  it('alternating 03:00 and 13:00 onsets gives 0 regularity', () => {
    const segs = [sleep(at(21, 3), 7), sleep(at(22, 13), 4), sleep(at(23, 3), 7), sleep(at(24, 13), 4)];
    expect(computeSleepHp(segs, NOW, T).regularity).toBe(0);
  });

  it('uses only duration with a single sleep day and caps it', () => {
    const r = computeSleepHp([sleep(at(24, 3), 11)], NOW, T);
    expect(r.regularity).toBeUndefined();
    expect(r.hp).toBe(1);
  });

  it('ignores sleeps outside the 7-day window', () => {
    const r = computeSleepHp([sleep(at(10, 23), 8), sleep(at(24, 6), 3)], NOW, T);
    expect(r.days).toBe(1);
    expect(r.avgHours).toBeCloseTo(3);
  });
});

describe('computeExerciseHp', () => {
  it('uses hours: 4.5h of 7h ≈ 64%', () => {
    const r = computeExerciseHp([ex(at(20, 18), 120), ex(at(22, 18), 90), ex(at(23, 7), 60)], undefined, NOW, T);
    expect(r.minutes).toBe(270);
    expect(r.hp).toBeCloseTo(4.5 / 7);
  });
  it('counts ongoing live and caps a forgotten one at 4h', () => {
    const live: Segment = { kind: 'exercise', startId: 'o', start: NOW - 30 * MINUTE };
    expect(computeExerciseHp([], live, NOW, T).minutes).toBeCloseTo(30);
    const forgotten: Segment = { kind: 'exercise', startId: 'o', start: NOW - 20 * HOUR };
    expect(computeExerciseHp([], forgotten, NOW, T).minutes).toBeCloseTo(240);
  });
  it('caps at 100%', () => {
    expect(computeExerciseHp([ex(at(22, 8), 600)], undefined, NOW, T).hp).toBe(1);
  });
  it('splits a session across midnight in the daily chart', () => {
    const e = dailyExercise([ex(at(23, 23, 30), 60)], undefined, NOW);
    expect(e[5].minutes).toBeCloseTo(30);
    expect(e[6].minutes).toBeCloseTo(30);
  });
});

it('hpLevel thresholds', () => {
  expect(hpLevel(0.61)).toBe('good');
  expect(hpLevel(0.6)).toBe('warn');
  expect(hpLevel(0.3)).toBe('warn');
  expect(hpLevel(0.29)).toBe('bad');
});

it('formatHours', () => {
  expect(formatHours(270)).toBe('4.5');
  expect(formatHours(420)).toBe('7');
});
