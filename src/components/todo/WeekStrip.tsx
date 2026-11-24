import { motion } from 'framer-motion';
import type { DueMark } from '../../lib/cards';
import { addDays } from '../../lib/time';
import { parseKey, weekDays, weekStartKey } from '../../lib/week';

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日'];
/** Two weeks are shown and paged at a time. */
export const STRIP_DAYS = 14;

interface Props {
  start: string; // Monday of the first row
  today: string;
  selected: string | null;
  marks: Map<string, DueMark[]>;
  onSelect: (day: string | null) => void;
  onWeek: (start: string) => void;
}

export default function WeekStrip({ start, today, selected, marks, onSelect, onWeek }: Props) {
  const days = weekDays(start, STRIP_DAYS);
  const first = parseKey(days[0]);
  const last = parseKey(days[days.length - 1]);
  const title =
    first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()
      ? `${first.getFullYear()}年${first.getMonth() + 1}月`
      : first.getFullYear() === last.getFullYear()
        ? `${first.getFullYear()}年${first.getMonth() + 1}月 – ${last.getMonth() + 1}月`
        : `${first.getFullYear()}/${first.getMonth() + 1} – ${last.getFullYear()}/${last.getMonth() + 1}`;
  const home = weekStartKey(today);
  const page = (dir: 1 | -1) => onWeek(addDays(start, dir * STRIP_DAYS));

  return (
    <div className="ui-card rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
      <div className="mb-1 flex items-center gap-1 px-1">
        <span className="flex-1 font-semibold">{title}</span>
        {start !== home && (
          <button onClick={() => onWeek(home)} className="rounded-full px-3 py-1 text-sm text-sky-600 dark:text-sky-400">
            今天
          </button>
        )}
        <button aria-label="前兩週" onClick={() => page(-1)} className="rounded-full px-3 py-1 text-slate-500">
          ‹
        </button>
        <button aria-label="後兩週" onClick={() => page(1)} className="rounded-full px-3 py-1 text-slate-500">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7">
        {WEEKDAY.map((w, i) => (
          <span key={w} className={`py-0.5 text-center text-xs ${i >= 5 ? 'text-slate-400' : 'text-slate-500'}`}>
            {w}
          </span>
        ))}
      </div>
      <motion.div
        key={start}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-7 gap-y-0.5"
        style={{ touchAction: 'pan-y' }}
        onPanEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 50 && Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.5) {
            page(info.offset.x < 0 ? 1 : -1);
          }
        }}
      >
        {days.map((d) => {
          const date = parseKey(d);
          const isToday = d === today;
          const isSel = d === selected;
          const isPast = d < today;
          const list = marks.get(d) ?? [];
          const pending = list.filter((m) => !m.done).length;
          const shownPending = Math.min(pending, 3);
          const shownDone = Math.min(list.length - pending, 3 - shownPending);
          return (
            <button
              key={d}
              onClick={() => onSelect(isSel ? null : d)}
              aria-pressed={isSel}
              aria-label={`${date.getMonth() + 1}月${date.getDate()}日 ${list.length ? `${pending} 項未完成` : '沒有到期'}`}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-1 ${isSel ? 'bg-sky-100 dark:bg-sky-900/50' : ''}`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums ${
                  isToday ? 'bg-sky-500 font-bold text-white' : isPast ? 'text-slate-400' : ''
                }`}
              >
                {date.getDate() === 1 ? `${date.getMonth() + 1}/1` : date.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {Array.from({ length: shownPending }, (_, j) => (
                  <span key={'p' + j} className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                ))}
                {Array.from({ length: shownDone }, (_, j) => (
                  <span key={'d' + j} className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                ))}
                {list.length > 3 && <span className="text-[9px] leading-none text-slate-500">+</span>}
              </span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
