import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { hpLevel, type HpLevel } from '../lib/hp';

const FILL: Record<HpLevel, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-400',
  bad: 'bg-red-500',
};

interface Props {
  icon: string;
  label: string;
  value: number; // 0–1
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

/**
 * Game-style HP bar. When the value drops, the main fill snaps down at once
 * while a pale "ghost" of the old length lingers, then drains after a delay.
 */
export default function HpBar({ icon, label, value, summary, expanded, onToggle, children }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const prev = useRef(pct);
  const dropping = pct < prev.current;
  const shake = useAnimationControls();

  useEffect(() => {
    if (pct < prev.current) void shake.start({ x: [0, -4, 4, -3, 2, 0], transition: { duration: 0.35 } });
    prev.current = pct;
  }, [pct, shake]);

  const level = hpLevel(value);

  return (
    <div className="ui-card rounded-2xl bg-white shadow-sm dark:bg-slate-900">
      <button onClick={onToggle} aria-expanded={expanded} className="block w-full px-4 pt-3 pb-3 text-left">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="font-semibold">
            {icon} {label}
          </span>
          <span className="font-mono text-lg font-bold tabular-nums">{pct}%</span>
        </div>
        <motion.div
          animate={shake}
          className="ui-hp relative h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} ${pct}%`}
        >
          {/* ghost: old length, drains after a delay when HP drops */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-red-300 dark:bg-red-400/60"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={dropping ? { delay: 0.6, duration: 0.9, ease: 'easeInOut' } : { duration: 0.5 }}
          />
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full ${FILL[level]}`}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: dropping ? 0.15 : 0.5, ease: 'easeOut' }}
          />
        </motion.div>
        <div className="mt-1.5 flex justify-between text-xs text-slate-500">
          <span>{summary}</span>
          <span>{expanded ? '收合 ▴' : '細節 ▾'}</span>
        </div>
      </button>
      {expanded && <div className="border-t border-slate-100 px-4 pt-3 pb-4 dark:border-slate-800">{children}</div>}
    </div>
  );
}
