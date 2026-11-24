import { addDays } from './time';

/** Weeks start on Monday. */
export function weekStartKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(key, -dow);
}

export function weekDays(startKey: string, count = 7): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startKey, i));
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
