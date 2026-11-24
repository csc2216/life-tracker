/*
 * HP calculations (pure). Rolling 7-day window ending at `now`.
 *
 * Sleep HP = 0.7 × duration + 0.3 × regularity
 *   duration = sigmoid(0.6 × (avgSleepHours − 5.8)), tuned so the hours alone
 *   land in the HP colour bands: 3–4h red (<30%), 5–6h yellow, 7–9h green (>60%).
 *   3h 16% · 4h 25% · 5h 38% · 6h 53% · 7h 67% · 8h 79% · 9h 87%
 *   (band edges: 30% at 4.39h, 60% at 6.48h).
 *   (Settings.sleepTargetHours only draws the chart's target line.)
 *   A "sleep day" is the day you woke up, with the day boundary at 18:00:
 *   waking before 18:00 counts for that day, after 18:00 for the next day.
 *   So 23:00→07:00, 06:00→09:00 and 03:00→14:00 all belong to the wake-up day,
 *   and naps that day add to its total.
 *   Regularity uses the main (longest) sleep's onset on a 24-hour circle:
 *   regularity = max(0, 1 − circularSD(onset) / sdLimit). On a circle 23:00 and
 *   01:00 are 2 h apart, so early-morning onsets are naturally a continuation
 *   of the previous night, whatever your schedule.
 *   With fewer than 2 sleep days regularity can't be measured, so HP = duration score alone.
 *
 * Exercise HP = min(totalHours / weeklyTargetHours, 1)
 *   A still-running session counts live, capped at ONGOING_EXERCISE_CAP.
 */
import type { Settings } from '../db/types';
import type { Segment } from './pairing';
import { addDays, dateKey, DAY, formatTime, HOUR, MINUTE, startOfDay } from './time';

export const WINDOW_DAYS = 7;
/** Waking after this hour counts toward the next sleep day. */
export const SLEEP_DAY_BOUNDARY_HOUR = 18;
/** A still-running session counts live, but at most this long (guards against a forgotten "end" tap). */
export const ONGOING_EXERCISE_CAP = 4 * HOUR;

type Targets = Pick<Settings, 'sleepStdDevMinutes' | 'exerciseTargetHours'>;

/** Hours at which the sleep-duration score is 50%. */
export const SLEEP_MIDPOINT_HOURS = 5.8;
/** How quickly the duration score rises per hour around the midpoint. */
export const SLEEP_SCORE_STEEPNESS = 0.6;
/** Share of sleep HP from duration; the rest is bedtime regularity. */
export const SLEEP_DURATION_WEIGHT = 0.7;
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const DAY_MIN = 24 * 60;

export function sleepDayKey(end: number): string {
  return dateKey(end + (24 - SLEEP_DAY_BOUNDARY_HOUR) * HOUR);
}

/** Minutes after local midnight, 0–1439. */
export function clockMinutes(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/** Circular mean and SD of clock times (minutes 0–1439). */
export function circularStats(mins: number[]): { mean: number; sd: number } {
  const ang = mins.map((m) => (m / DAY_MIN) * 2 * Math.PI);
  const c = ang.reduce((a, x) => a + Math.cos(x), 0) / ang.length;
  const s = ang.reduce((a, x) => a + Math.sin(x), 0) / ang.length;
  const r = Math.min(1, Math.hypot(c, s));
  let mean = (Math.atan2(s, c) / (2 * Math.PI)) * DAY_MIN;
  if (mean < 0) mean += DAY_MIN;
  const sdRad = r <= 1e-12 ? Infinity : Math.sqrt(-2 * Math.log(r));
  return { mean, sd: (sdRad / (2 * Math.PI)) * DAY_MIN };
}

export interface SleepDay {
  key: string;
  minutes: number;
  /** segments that day */
  count: number;
  /** main (longest) sleep */
  mainStart: number;
  mainEnd: number;
}

export function groupSleepDays(segments: Segment[]): SleepDay[] {
  const map = new Map<string, SleepDay>();
  for (const s of segments) {
    if (s.kind !== 'sleep' || s.end === undefined) continue;
    const key = sleepDayKey(s.end);
    const len = s.end - s.start;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { key, minutes: len / MINUTE, count: 1, mainStart: s.start, mainEnd: s.end });
    } else {
      cur.minutes += len / MINUTE;
      cur.count += 1;
      if (len > cur.mainEnd - cur.mainStart) {
        cur.mainStart = s.start;
        cur.mainEnd = s.end;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export interface SleepHp {
  hp: number;
  days: number;
  avgHours: number;
  durationScore: number;
  /** undefined when < 2 sleep days */
  sdMinutes?: number;
  regularity?: number;
  /** circular mean onset, minutes after midnight */
  avgOnset?: number;
}

export function computeSleepHp(segments: Segment[], now: number, t: Targets): SleepHp {
  const from = now - WINDOW_DAYS * DAY;
  const days = groupSleepDays(segments.filter((s) => s.end !== undefined && s.end > from && s.end <= now));
  if (days.length === 0) return { hp: 0, days: 0, avgHours: 0, durationScore: 0 };

  const avgHours = days.reduce((a, n) => a + n.minutes, 0) / days.length / 60;
  const durationScore = sigmoid(SLEEP_SCORE_STEEPNESS * (avgHours - SLEEP_MIDPOINT_HOURS));
  const { mean, sd } = circularStats(days.map((d) => clockMinutes(d.mainStart)));
  if (days.length < 2) return { hp: durationScore, days: 1, avgHours, durationScore, avgOnset: mean };

  const regularity = Math.max(0, 1 - sd / t.sleepStdDevMinutes);
  return {
    hp: SLEEP_DURATION_WEIGHT * durationScore + (1 - SLEEP_DURATION_WEIGHT) * regularity,
    days: days.length,
    avgHours,
    durationScore,
    sdMinutes: sd,
    regularity,
    avgOnset: mean,
  };
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Exercise segments; an ongoing one counts up to `now`, capped. */
function exerciseRanges(segments: Segment[], ongoing: Segment | undefined, now: number): [number, number][] {
  const r: [number, number][] = segments.filter((s) => s.kind === 'exercise' && s.end !== undefined).map((s) => [s.start, s.end!]);
  if (ongoing) r.push([ongoing.start, Math.min(now, ongoing.start + ONGOING_EXERCISE_CAP)]);
  return r;
}

export interface ExerciseHp {
  hp: number;
  minutes: number;
}

export function computeExerciseHp(segments: Segment[], ongoing: Segment | undefined, now: number, t: Targets): ExerciseHp {
  const from = now - WINDOW_DAYS * DAY;
  const minutes = exerciseRanges(segments, ongoing, now).reduce((a, [s, e]) => a + overlap(s, e, from, now), 0) / MINUTE;
  return { hp: Math.min(minutes / (t.exerciseTargetHours * 60), 1), minutes };
}

export interface DayValue {
  key: string;
  minutes: number;
  /** extra context shown when the bar is selected */
  detail?: string;
}

/** Last 7 sleep days ending today. */
export function dailySleep(segments: Segment[], now: number): DayValue[] {
  const byKey = new Map(groupSleepDays(segments).map((d) => [d.key, d]));
  const today = dateKey(now);
  return Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const key = addDays(today, i - WINDOW_DAYS + 1);
    const d = byKey.get(key);
    if (!d) return { key, minutes: 0 };
    const extra = d.count > 1 ? ` ＋${d.count - 1} 段小睡` : '';
    return { key, minutes: d.minutes, detail: `${formatTime(d.mainStart)}–${formatTime(d.mainEnd)}${extra}` };
  });
}

/** Last 7 calendar days; a session crossing midnight is split between the days. */
export function dailyExercise(segments: Segment[], ongoing: Segment | undefined, now: number): DayValue[] {
  const ranges = exerciseRanges(segments, ongoing, now);
  const today = startOfDay(now);
  return Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const d0 = startOfDay(today - (WINDOW_DAYS - 1 - i) * DAY + 12 * HOUR); // DST-safe
    const d1 = startOfDay(d0 + 36 * HOUR);
    const minutes = ranges.reduce((a, [s, e]) => a + overlap(s, e, d0, d1), 0) / MINUTE;
    return { key: dateKey(d0), minutes };
  });
}

export type HpLevel = 'good' | 'warn' | 'bad';
export function hpLevel(v: number): HpLevel {
  if (v > 0.6) return 'good';
  if (v >= 0.3) return 'warn';
  return 'bad';
}

export function formatOnset(min: number): string {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(Math.round(h * 10) / 10) ? String(Math.round(h)) : h.toFixed(1);
}
