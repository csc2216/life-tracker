import { useState } from 'react';
import type { DayValue } from '../lib/hp';
import { dayLabel } from '../lib/time';

interface Props {
  data: DayValue[];
  /** target in the same unit as minutes; drawn as a dashed line */
  target: number;
  targetLabel: string;
  format: (minutes: number) => string;
  barClass: string;
  now: number;
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const CHART_H = 96;

/** Single-series daily bar chart. Tap a bar to read its value. */
export default function DayBars({ data, target, targetLabel, format, barClass, now }: Props) {
  const [sel, setSel] = useState(data.length - 1);
  const max = Math.max(target * 1.25, ...data.map((d) => d.minutes)) || 1;
  const y = (v: number) => (v / max) * CHART_H;
  const selected = data[Math.min(sel, data.length - 1)];

  return (
    <div>
      <p className="mb-2 text-sm">
        <span className="text-slate-500">{dayLabel(selected.key, now)}　</span>
        <span className="font-semibold tabular-nums">{selected.minutes > 0 ? format(selected.minutes) : '沒有紀錄'}</span>
        {selected.detail && <span className="text-slate-500">　{selected.detail}</span>}
      </p>
      <div className="relative" style={{ height: CHART_H }}>
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-400 dark:border-slate-500"
          style={{ bottom: y(target) }}
        >
          <span className="absolute -top-4 right-0 text-[10px] text-slate-500">{targetLabel}</span>
        </div>
        <div className="absolute inset-0 flex items-end justify-between border-b border-slate-200 dark:border-slate-700">
          {data.map((d, i) => (
            <button
              key={d.key}
              onClick={() => setSel(i)}
              aria-label={`${dayLabel(d.key, now)} ${d.minutes > 0 ? format(d.minutes) : '沒有紀錄'}`}
              className="flex h-full flex-1 items-end justify-center"
            >
              <span
                className={`w-4 rounded-t ${barClass} ${i === sel ? '' : 'opacity-60'}`}
                style={{ height: Math.max(d.minutes > 0 ? 3 : 0, y(d.minutes)) }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between">
        {data.map((d, i) => {
          const [yy, m, dd] = d.key.split('-').map(Number);
          return (
            <span
              key={d.key}
              className={`flex-1 text-center text-[11px] ${i === sel ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
            >
              {WEEKDAY[new Date(yy, m - 1, dd).getDay()]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
