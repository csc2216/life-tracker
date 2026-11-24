import type { LogEvent } from '../db/types';
import { EVENT_META } from '../db/types';
import type { PairingResult } from '../lib/pairing';
import { dateKey, dayLabel, formatDuration, formatTime } from '../lib/time';

interface Props {
  events: LogEvent[]; // newest first, already filtered to range
  pairing: PairingResult;
  now: number;
  onSelect: (e: LogEvent) => void;
}

function describe(ev: LogEvent, p: PairingResult, now: number): { title: string; detail?: string } {
  const seg = p.segmentByEventId.get(ev.id);
  const meta = EVENT_META[ev.type];
  switch (ev.type) {
    case 'sleep':
      if (seg && seg.end === undefined) return { title: meta.label, detail: `睡眠中 ${formatDuration(now - seg.start)}` };
      return { title: meta.label, detail: ev.note };
    case 'wake':
      return { title: meta.label, detail: seg?.end ? `睡了 ${formatDuration(seg.end - seg.start)}` : ev.note };
    case 'exercise_start':
      return {
        title: `${meta.label}${ev.note ? ` · ${ev.note}` : ''}`,
        detail: seg && seg.end === undefined ? '進行中' : undefined,
      };
    case 'exercise_end':
      return {
        title: `${meta.label}${seg?.note ? ` · ${seg.note}` : ''}`,
        detail: seg?.end ? `運動 ${formatDuration(seg.end - seg.start)}` : ev.note,
      };
    default:
      return { title: meta.label, detail: ev.note };
  }
}

export default function EventList({ events, pairing, now, onSelect }: Props) {
  if (events.length === 0) {
    return <p className="py-10 text-center text-slate-500">還沒有紀錄，按上面的按鈕開始吧</p>;
  }

  const groups: { key: string; items: LogEvent[] }[] = [];
  for (const e of events) {
    const key = dateKey(e.timestamp);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(e);
    else groups.push({ key, items: [e] });
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-1 px-1 text-sm font-medium text-slate-500">{dayLabel(g.key, now)}</h3>
          <ul className="ui-card divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-slate-800 dark:bg-slate-900">
            {g.items.map((e) => {
              const { title, detail } = describe(e, pairing, now);
              const unpaired = pairing.unpairedIds.has(e.id);
              return (
                <li key={e.id}>
                  <button
                    onClick={() => onSelect(e)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
                  >
                    <span className="text-2xl">{EVENT_META[e.type].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{title}</span>
                      {detail && <span className="block truncate text-sm text-slate-500">{detail}</span>}
                    </span>
                    {unpaired && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        未配對
                      </span>
                    )}
                    <span className="font-mono text-sm tabular-nums text-slate-500">{formatTime(e.timestamp)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
