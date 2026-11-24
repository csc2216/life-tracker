import { useEffect, useState } from 'react';
import { addCard } from '../../db/cardOps';
import type { Column, Task } from '../../db/types';
import Sheet from '../Sheet';
import { ColumnPicker, DueInput, Field, inputCls, TaskEditor } from './fields';

interface Props {
  open: boolean;
  defaultColumn: Exclude<Column, 'done'>;
  defaultDue?: string;
  onClose: () => void;
}

export default function AddCardSheet({ open, defaultColumn, defaultDue, onClose }: Props) {
  const [kind, setKind] = useState<'single' | 'project'>('single');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState<string | undefined>();
  const [column, setColumn] = useState<Column>(defaultColumn);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setDue(defaultDue);
    setColumn(defaultColumn);
    setTasks([]);
  }, [open, defaultColumn, defaultDue]);

  const save = async () => {
    const t = title.trim();
    if (!t) return;
    await addCard({
      kind,
      column,
      title: t,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(due ? { due } : {}),
      tasks: kind === 'project' ? tasks.filter((x) => x.title.trim()) : [],
    });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="新增">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(['single', 'project'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 rounded-xl py-2.5 font-medium ${kind === k ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              {k === 'single' ? '單一任務' : 'Project'}
            </button>
          ))}
        </div>
        <Field label="標題">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="簡短描述（選填）">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>
        <Field label="截止日（選填）">
          <DueInput value={due} onChange={setDue} />
        </Field>
        <div>
          <span className="mb-1 block text-sm text-slate-500">放在</span>
          <ColumnPicker value={column} onChange={setColumn} allowDone={false} />
        </div>
        {kind === 'project' && (
          <div>
            <span className="mb-1 block text-sm text-slate-500">小任務</span>
            <TaskEditor tasks={tasks} onChange={setTasks} allowTick={false} />
          </div>
        )}
        <button onClick={() => void save()} disabled={!title.trim()} className="w-full rounded-xl bg-sky-500 py-3 font-medium text-white disabled:opacity-40">
          新增
        </button>
      </div>
    </Sheet>
  );
}
