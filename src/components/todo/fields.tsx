import { useState } from 'react';
import type { Column, Task } from '../../db/types';
import { newId } from '../../lib/id';

export const inputCls = 'w-full rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function DueInput({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex gap-2">
      <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className={inputCls} />
      {value && (
        <button type="button" onClick={() => onChange(undefined)} className="shrink-0 rounded-xl px-3 text-sm text-slate-500">
          清除
        </button>
      )}
    </div>
  );
}

const COL_LABEL: Record<Column, string> = { long: 'Long term', short: 'Short term', done: 'Done' };

export function ColumnPicker({ value, onChange, allowDone }: { value: Column; onChange: (c: Column) => void; allowDone: boolean }) {
  const cols: Column[] = allowDone ? ['long', 'short', 'done'] : ['long', 'short'];
  return (
    <div className="flex gap-2">
      {cols.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`flex-1 rounded-xl py-2 text-sm ${value === c ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
        >
          {COL_LABEL[c]}
        </button>
      ))}
    </div>
  );
}

/** Editable sub-task list for a project. */
/** `allowTick`: ticking here (edit sheet) sends the task to Done on save. */
export function TaskEditor({ tasks, onChange, allowTick = true }: { tasks: Task[]; onChange: (t: Task[]) => void; allowTick?: boolean }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    onChange([...tasks, { id: newId(), title, done: false }]);
    setDraft('');
  };
  const patch = (id: string, p: Partial<Task>) => onChange(tasks.map((t) => (t.id === id ? { ...t, ...p } : t)));

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-2">
          {allowTick && <input type="checkbox" checked={t.done} onChange={(e) => patch(t.id, { done: e.target.checked })} className="h-5 w-5 shrink-0 accent-emerald-500" aria-label="完成（儲存後移到 Done）" />}
          <input value={t.title} onChange={(e) => patch(t.id, { title: e.target.value })} className={`${inputCls} min-w-0 flex-1 py-2`} />
          <input
            type="date"
            value={t.due ?? ''}
            onChange={(e) => patch(t.id, { due: e.target.value || undefined })}
            className="w-[7.5rem] shrink-0 rounded-xl bg-slate-100 px-2 py-2 text-sm dark:bg-slate-800"
            aria-label="截止日"
          />
          <button type="button" aria-label="刪除小任務" onClick={() => onChange(tasks.filter((x) => x.id !== t.id))} className="shrink-0 px-1 text-slate-400">
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="新增小任務"
          className={`${inputCls} flex-1 py-2`}
        />
        <button type="button" onClick={add} className="shrink-0 rounded-xl bg-slate-200 px-4 text-sm dark:bg-slate-700">
          加入
        </button>
      </div>
    </div>
  );
}
