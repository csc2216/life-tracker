import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { addExerciseType, db, useSettings } from '../db/db';

interface Props {
  value?: string;
  onChange: (v: string | undefined) => void;
}

/** Chips of exercise types, most used first, plus a custom input. */
export default function ExerciseTypePicker({ value, onChange }: Props) {
  const settings = useSettings();
  const starts = useLiveQuery(() => db.events.where('type').equals('exercise_start').toArray(), []);
  const [custom, setCustom] = useState('');
  const [adding, setAdding] = useState(false);

  const types = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of starts ?? []) if (e.note) count.set(e.note, (count.get(e.note) ?? 0) + 1);
    const list = [...settings.exerciseTypes];
    if (value && !list.includes(value)) list.push(value);
    return list
      .map((t, i) => ({ t, i, c: count.get(t) ?? 0 }))
      .sort((a, b) => b.c - a.c || a.i - b.i)
      .map((x) => x.t);
  }, [settings.exerciseTypes, starts, value]);

  const submitCustom = async () => {
    const t = custom.trim();
    if (!t) return;
    await addExerciseType(t);
    onChange(t);
    setCustom('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {types.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(value === t ? undefined : t)}
          className={`rounded-full border px-4 py-2 text-sm ${
            value === t
              ? 'border-sky-500 bg-sky-500 text-white'
              : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          {t}
        </button>
      ))}
      {adding ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submitCustom();
          }}
        >
          <input
            autoFocus
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="運動名稱"
            className="w-28 rounded-full border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          />
          <button type="submit" className="rounded-full bg-sky-500 px-3 text-sm text-white">
            加入
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-slate-400 px-4 py-2 text-sm text-slate-500"
        >
          ＋自訂
        </button>
      )}
    </div>
  );
}
