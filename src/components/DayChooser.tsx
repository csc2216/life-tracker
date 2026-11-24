import { addDays, dateKey } from '../lib/time';

/** 今天 / 昨天 / 選日期 */
export default function DayChooser({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = dateKey(Date.now());
  const yesterday = addDays(today, -1);
  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm ${
      active ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800'
    }`;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={chip(value === today)} onClick={() => onChange(today)}>
        今天
      </button>
      <button type="button" className={chip(value === yesterday)} onClick={() => onChange(yesterday)}>
        昨天
      </button>
      <input
        type="date"
        value={value}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className={`${chip(value !== today && value !== yesterday)} min-w-0 flex-1`}
      />
    </div>
  );
}
