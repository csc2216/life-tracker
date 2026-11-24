import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import type { EventType, LogEvent } from '../db/types';
import { newId } from '../lib/id';
import { addDays, combine, dateKey, formatDuration, HOUR, MINUTE, shortDateTime, timeKey } from '../lib/time';
import DayChooser from './DayChooser';
import ExerciseTypePicker from './ExerciseTypePicker';
import Sheet from './Sheet';

export type BackfillMode = 'meal' | 'sleep_session' | 'sleep' | 'wake' | 'exercise_session' | 'exercise_start' | 'exercise_end';

export interface BackfillInitial {
  mode: BackfillMode;
  ts?: number;
}

const MODES: { id: BackfillMode; label: string }[] = [
  { id: 'sleep_session', label: '😴 整段睡眠' },
  { id: 'exercise_session', label: '🏃 整段運動' },
  { id: 'meal', label: '🍚 吃飯' },
  { id: 'sleep', label: '😴 只補入睡' },
  { id: 'wake', label: '☀️ 只補起床' },
  { id: 'exercise_start', label: '🏃 只補運動開始' },
  { id: 'exercise_end', label: '🏁 只補運動結束' },
];

interface Props {
  open: boolean;
  initial?: BackfillInitial;
  onClose: () => void;
  onSaved: (ids: string[], message: string) => void;
}

const inputCls = 'w-full rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800';

export default function BackfillSheet({ open, initial, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<BackfillMode>('sleep_session');
  const [date, setDate] = useState(dateKey(Date.now()));
  const [time, setTime] = useState('12:00');
  const [sleepTime, setSleepTime] = useState('23:30');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [exStart, setExStart] = useState('18:00');
  const [exEnd, setExEnd] = useState('19:00');
  const [useDuration, setUseDuration] = useState(false);
  const [durationMin, setDurationMin] = useState('60');
  const [exType, setExType] = useState<string | undefined>();
  const [error, setError] = useState('');

  // Reset to sensible defaults every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const now = Date.now();
    const m = initial?.mode ?? 'sleep_session';
    setMode(m);
    setError('');
    setExType(undefined);
    setUseDuration(false);
    setDurationMin('60');
    const ts = initial?.ts ?? now;
    setTime(timeKey(ts));
    if (m === 'exercise_session') {
      setDate(dateKey(now - HOUR));
      setExStart(timeKey(now - HOUR));
      setExEnd(timeKey(now));
    } else if (m === 'sleep_session') {
      setDate(dateKey(now));
      setSleepTime('23:30');
      setWakeTime('07:00');
    } else {
      setDate(dateKey(ts));
    }
  }, [open, initial]);

  // Switching mode inside the sheet: give session modes fresh defaults.
  const switchMode = (m: BackfillMode) => {
    setMode(m);
    setError('');
    const now = Date.now();
    if (m === 'exercise_session') {
      setDate(dateKey(now - HOUR));
      setExStart(timeKey(now - HOUR));
      setExEnd(timeKey(now));
    } else if (m === 'sleep_session') {
      setDate(dateKey(now));
    }
  };

  const plan = useMemo((): { events: Omit<LogEvent, 'id'>[]; summary: string } | { error: string } => {
    const single = (type: EventType, note?: string) => {
      if (!time) return { error: '請選時間' };
      const ts = combine(date, time);
      return { events: [{ type, timestamp: ts, note }], summary: shortDateTime(ts) };
    };
    switch (mode) {
      case 'meal':
      case 'sleep':
      case 'wake':
      case 'exercise_end':
        return single(mode);
      case 'exercise_start':
        return single(mode, exType);
      case 'sleep_session': {
        if (!sleepTime || !wakeTime) return { error: '請選時間' };
        // `date` is the morning you woke up; a later-in-day sleep time means the previous night.
        const sleepDate = sleepTime > wakeTime ? addDays(date, -1) : date;
        const s = combine(sleepDate, sleepTime);
        const w = combine(date, wakeTime);
        if (w <= s) return { error: '起床時間要晚於入睡時間' };
        return {
          events: [
            { type: 'sleep', timestamp: s },
            { type: 'wake', timestamp: w },
          ],
          summary: `${shortDateTime(s)} → ${shortDateTime(w)}，共 ${formatDuration(w - s)}`,
        };
      }
      case 'exercise_session': {
        if (!exStart) return { error: '請選時間' };
        const s = combine(date, exStart);
        let e: number;
        if (useDuration) {
          const mins = Number(durationMin);
          if (!Number.isFinite(mins) || mins <= 0) return { error: '時長要大於 0' };
          e = s + mins * MINUTE;
        } else {
          if (!exEnd) return { error: '請選時間' };
          e = combine(exEnd <= exStart ? addDays(date, 1) : date, exEnd);
        }
        return {
          events: [
            { type: 'exercise_start', timestamp: s, note: exType },
            { type: 'exercise_end', timestamp: e },
          ],
          summary: `${shortDateTime(s)} → ${shortDateTime(e)}，共 ${formatDuration(e - s)}`,
        };
      }
    }
  }, [mode, date, time, sleepTime, wakeTime, exStart, exEnd, useDuration, durationMin, exType]);

  const save = async () => {
    if ('error' in plan) return setError(plan.error);
    if (plan.events.some((e) => e.timestamp > Date.now() + MINUTE)) return setError('時間不能在未來');
    const rows: LogEvent[] = plan.events.map((e) => ({
      id: newId(),
      type: e.type,
      timestamp: e.timestamp,
      ...(e.note ? { note: e.note } : {}),
    }));
    await db.events.bulkAdd(rows);
    onSaved(
      rows.map((r) => r.id),
      `已補登 ${MODES.find((m) => m.id === mode)?.label.replace(/^\S+\s/, '')}`,
    );
    onClose();
  };

  const isSession = mode === 'sleep_session' || mode === 'exercise_session';

  return (
    <Sheet open={open} onClose={onClose} title="補紀錄">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => switchMode(m.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                mode === m.id ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div>
          <span className="mb-1 block text-sm text-slate-500">
            {mode === 'sleep_session' ? '起床那天' : '日期'}
          </span>
          <DayChooser value={date} onChange={setDate} />
        </div>

        {!isSession && (
          <label className="block">
            <span className="mb-1 block text-sm text-slate-500">時間</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </label>
        )}

        {mode === 'sleep_session' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-500">😴 入睡</span>
              <input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-500">☀️ 起床</span>
              <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={inputCls} />
            </label>
          </div>
        )}

        {mode === 'exercise_session' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm text-slate-500">開始</span>
                <input type="time" value={exStart} onChange={(e) => setExStart(e.target.value)} className={inputCls} />
              </label>
              <div>
                <div className="mb-1 flex gap-2 text-sm">
                  <button className={!useDuration ? 'font-semibold text-sky-600' : 'text-slate-500'} onClick={() => setUseDuration(false)}>
                    結束時間
                  </button>
                  <span className="text-slate-400">/</span>
                  <button className={useDuration ? 'font-semibold text-sky-600' : 'text-slate-500'} onClick={() => setUseDuration(true)}>
                    時長
                  </button>
                </div>
                {useDuration ? (
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={durationMin}
                      onChange={(e) => setDurationMin(e.target.value)}
                      className={inputCls}
                    />
                    <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">分鐘</span>
                  </div>
                ) : (
                  <input type="time" value={exEnd} onChange={(e) => setExEnd(e.target.value)} className={inputCls} />
                )}
              </div>
            </div>
          </>
        )}

        {(mode === 'exercise_session' || mode === 'exercise_start') && (
          <div>
            <span className="mb-1 block text-sm text-slate-500">運動類型</span>
            <ExerciseTypePicker value={exType} onChange={setExType} />
          </div>
        )}

        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {'error' in plan ? plan.error : plan.summary}
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}

        <button onClick={save} className="w-full rounded-xl bg-sky-500 py-3 font-medium text-white">
          儲存
        </button>
      </div>
    </Sheet>
  );
}
