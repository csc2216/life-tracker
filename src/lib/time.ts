const pad = (n: number) => String(n).padStart(2, '0');

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / MINUTE));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Local date key YYYY-MM-DD */
export function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeKey(ts: number): string {
  return formatTime(ts);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n).getTime());
}

/** Combine local YYYY-MM-DD + HH:mm into a timestamp */
export function combine(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

export function toLocalInput(ts: number): string {
  return `${dateKey(ts)}T${formatTime(ts)}`;
}

export function fromLocalInput(s: string): number {
  const [date, time] = s.split('T');
  return combine(date, time);
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function dayLabel(key: string, now = Date.now()): string {
  const today = dateKey(now);
  if (key === today) return '今天';
  if (key === addDays(today, -1)) return '昨天';
  if (key === addDays(today, 1)) return '明天';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const yearPart = y !== new Date(now).getFullYear() ? `${y}年` : '';
  return `${yearPart}${m}月${d}日（${WEEKDAYS[dt.getDay()]}）`;
}

export function shortDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(ts)}`;
}
