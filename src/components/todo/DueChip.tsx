import { dueStatus } from '../../lib/cards';
import { addDays } from '../../lib/time';

const STYLE = {
  overdue: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  today: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  upcoming: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  done: 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500',
};

export default function DueChip({ due, today, done }: { due: string; today: string; done: boolean }) {
  const status = dueStatus(due, today, done);
  const [, m, d] = due.split('-').map(Number);
  const label =
    due === today ? '今天' : due === addDays(today, 1) ? '明天' : status === 'overdue' ? `逾期 ${m}/${d}` : `${m}/${d}`;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STYLE[status]}`}>{label}</span>;
}
