import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import BackfillSheet, { type BackfillInitial } from '../components/BackfillSheet';
import EventEditSheet from '../components/EventEditSheet';
import EventList from '../components/EventList';
import HpPanel from '../components/HpPanel';
import ExerciseTypePicker from '../components/ExerciseTypePicker';
import QuickButtons from '../components/QuickButtons';
import Sheet from '../components/Sheet';
import Toast, { type ToastState } from '../components/Toast';
import { db } from '../db/db';
import { EVENT_META, type LogEvent } from '../db/types';
import { newId } from '../lib/id';
import { pairEvents } from '../lib/pairing';
import { DAY, formatDuration, formatTime, startOfDay } from '../lib/time';
import { useNow } from '../lib/useNow';

const PAGE_DAYS = 14;

export default function LogPage() {
  const events = useLiveQuery(() => db.events.orderBy('timestamp').toArray(), []);
  const now = useNow(30_000);
  const pairing = useMemo(() => pairEvents(events ?? [], now), [events, now]);

  const [days, setDays] = useState(PAGE_DAYS);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editing, setEditing] = useState<LogEvent | null>(null);
  const [backfill, setBackfill] = useState<{ open: boolean; initial?: BackfillInitial }>({ open: false });
  const [typePickerFor, setTypePickerFor] = useState<string | null>(null);

  const clearToast = useCallback(() => setToast(null), []);
  const showToast = (message: string, undoIds?: string[]) =>
    setToast({
      key: Date.now(),
      message,
      onUndo: undoIds ? () => void db.events.bulkDelete(undoIds) : undefined,
    });

  const add = async (type: LogEvent['type']) => {
    const ev: LogEvent = { id: newId(), type, timestamp: Date.now() };
    await db.events.add(ev);
    return ev;
  };

  const onLog = async (type: 'meal' | 'sleep' | 'wake') => {
    const ev = await add(type);
    showToast(`已紀錄${EVENT_META[type].label} ${formatTime(ev.timestamp)}`, [ev.id]);
  };

  const onExercise = async () => {
    const ongoing = pairing.ongoingExercise;
    if (ongoing) {
      const ev = await add('exercise_end');
      showToast(`運動結束${ongoing.note ? ` · ${ongoing.note}` : ''} ${formatDuration(ev.timestamp - ongoing.start)}`, [ev.id]);
    } else {
      const ev = await add('exercise_start');
      setTypePickerFor(ev.id);
      showToast(`開始運動 ${formatTime(ev.timestamp)}`, [ev.id]);
    }
  };

  const cutoff = startOfDay(now) - (days - 1) * DAY;
  const visible = useMemo(
    () => (events ?? []).filter((e) => e.timestamp >= cutoff).reverse(),
    [events, cutoff],
  );
  const hasMore = (events ?? []).some((e) => e.timestamp < cutoff);
  const unpairedCount = pairing.unpairedIds.size;

  const pickerNote = typePickerFor
    ? events?.find((e) => e.id === typePickerFor)?.note
    : undefined;

  return (
    <div className="space-y-4 px-4 pt-4">
      <h1 className="text-2xl font-bold">紀錄</h1>

      <HpPanel pairing={pairing} now={now} />

      <QuickButtons
        ongoingExercise={pairing.ongoingExercise}
        onLog={onLog}
        onExercise={onExercise}
        onEditExerciseType={() => setTypePickerFor(pairing.ongoingExercise?.startId ?? null)}
      />

      <button
        onClick={() => setBackfill({ open: true })}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-3 font-medium text-slate-600 active:bg-slate-200 dark:border-slate-700 dark:text-slate-300 dark:active:bg-slate-800"
      >
        ＋ 補紀錄
      </button>

      {unpairedCount > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          有 {unpairedCount} 筆未配對的紀錄，點該筆紀錄即可修正或補上另一半。
        </p>
      )}

      <EventList events={visible} pairing={pairing} now={now} onSelect={setEditing} />

      {hasMore && (
        <button onClick={() => setDays((d) => d + PAGE_DAYS)} className="w-full py-3 text-sm text-sky-600">
          載入更多
        </button>
      )}

      <EventEditSheet
        event={editing}
        pairing={pairing}
        onClose={() => setEditing(null)}
        onBackfill={(initial) => {
          setEditing(null);
          setBackfill({ open: true, initial });
        }}
      />

      <BackfillSheet
        open={backfill.open}
        initial={backfill.initial}
        onClose={() => setBackfill({ open: false })}
        onSaved={(ids, msg) => showToast(msg, ids)}
      />

      <Sheet open={!!typePickerFor} onClose={() => setTypePickerFor(null)} title="什麼運動？">
        <ExerciseTypePicker
          value={pickerNote}
          onChange={async (v) => {
            if (!typePickerFor) return;
            await db.events.update(typePickerFor, { note: v });
            if (v) setTypePickerFor(null);
          }}
        />
        <button onClick={() => setTypePickerFor(null)} className="mt-5 w-full py-2 text-sm text-slate-500">
          略過，之後再選
        </button>
      </Sheet>

      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
