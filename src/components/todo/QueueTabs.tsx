import { motion } from 'framer-motion';
import type { Column } from '../../db/types';
import { COLUMNS } from '../../lib/cards';

export default function QueueTabs({ value, counts, onChange }: { value: Column; counts: Record<Column, number>; onChange: (c: Column) => void }) {
  return (
    <div className="flex rounded-2xl bg-slate-200/70 p-1 dark:bg-slate-800">
      {COLUMNS.map((c) => (
        <button key={c.id} onClick={() => onChange(c.id)} className="relative flex-1 rounded-xl py-2 text-sm font-medium">
          {value === c.id && (
            <motion.span layoutId="queue-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-slate-700" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />
          )}
          <span className={`relative ${value === c.id ? '' : 'text-slate-500'}`}>
            {c.label}{' '}
            <motion.span key={counts[c.id]} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="inline-block text-xs text-slate-500 tabular-nums">
              {counts[c.id]}
            </motion.span>
          </span>
        </button>
      ))}
    </div>
  );
}
