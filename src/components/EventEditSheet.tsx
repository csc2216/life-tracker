import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { EVENT_META, EVENT_TYPES, type EventType, type LogEvent } from '../db/types';
import type { PairingResult } from '../lib/pairing';
import { fromLocalInput, HOUR, toLocalInput } from '../lib/time';
import ExerciseTypePicker from './ExerciseTypePicker';
import Sheet from './Sheet';
import type { BackfillInitial } from './BackfillSheet';

interface Props {
  event: LogEvent | null;
  pairing: PairingResult;
  onClose: () => void;
  onBackfill: (initial: BackfillInitial) => void;
}

const COMPLEMENT: Record<EventType, { mode: BackfillInitial['mode']; offset: number; label: string } | null> = {
  sleep: { mode: 'wake', offset: 7.5 * HOUR, label: '補上這次的起床時間' },
  wake: { mode: 'sleep', offset: -7.5 * HOUR, label: '補上這次的入睡時間' },
  exercise_start: { mode: 'exercise_end', offset: HOUR, label: '補上運動結束時間' },
  exercise_end: { mode: 'exercise_start', offset: -HOUR, label: '補上運動開始時間' },
  meal: null,
};

export default function EventEditSheet({ event, pairing, onClose, onBackfill }: Props) {
  const [type, setType] = useState<EventType>('meal');
  const [local, setLocal] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!event) return;
    setType(event.type);
    setLocal(toLocalInput(event.timestamp));
    setNote(event.note ?? '');
  }, [event]);

  const save = async () => {
    if (!event || !local) return;
    const trimmed = note.trim();
    await db.events.update(event.id, {
      type,
      timestamp: fromLocalInput(local),
      note: trimmed || undefined,
    });
    onClose();
  };

  const remove = async () => {
    if (!event) return;
    if (!confirm('確定刪除這筆紀錄？')) return;
    await db.events.delete(event.id);
    onClose();
  };

  const unpaired = event && pairing.unpairedIds.has(event.id);
  const comp = event ? COMPLEMENT[event.type] : null;

  return (
    <Sheet open={!!event} onClose={onClose} title="編輯紀錄">
      <div className="space-y-4">
        {unpaired && comp && event && (
          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="mb-2">這筆紀錄沒有配對到對應的事件。</p>
            <button
              className="w-full rounded-xl bg-amber-500 py-2 font-medium text-white"
              onClick={() => {
                const ts = Math.min(event.timestamp + comp.offset, Date.now());
                onBackfill({ mode: comp.mode, ts });
              }}
            >
              {comp.label}
            </button>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm text-slate-500">類型</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventType)}
            className="w-full rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_META[t].icon} {EVENT_META[t].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-500">時間</span>
          <input
            type="datetime-local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="w-full rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800"
          />
        </label>

        {type === 'exercise_start' ? (
          <div>
            <span className="mb-1 block text-sm text-slate-500">運動類型</span>
            <ExerciseTypePicker value={note || undefined} onChange={(v) => setNote(v ?? '')} />
          </div>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm text-slate-500">備註</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800"
            />
          </label>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={remove} className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-600 dark:bg-red-950 dark:text-red-300">
            刪除
          </button>
          <button onClick={save} className="flex-1 rounded-xl bg-sky-500 py-3 font-medium text-white">
            儲存
          </button>
        </div>
      </div>
    </Sheet>
  );
}
