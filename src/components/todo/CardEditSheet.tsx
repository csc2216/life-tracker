import { useEffect, useState } from 'react';
import { deleteCard, saveCard } from '../../db/cardOps';
import type { Card, Column, Task } from '../../db/types';
import Sheet from '../Sheet';
import { ColumnPicker, DueInput, Field, inputCls, TaskEditor } from './fields';

export default function CardEditSheet({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState<string | undefined>();
  const [column, setColumn] = useState<Column>('short');
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description ?? '');
    setDue(card.due);
    setColumn(card.column);
    setTasks(card.tasks);
  }, [card]);

  const save = async () => {
    if (!card || !title.trim()) return;
    await saveCard(card.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      due,
      column,
      tasks: tasks.filter((t) => t.title.trim()).map((t) => ({ ...t, title: t.title.trim() })),
    });
    onClose();
  };

  const remove = async () => {
    if (!card || !confirm(`確定刪除「${card.title}」？`)) return;
    await deleteCard(card.id);
    onClose();
  };

  return (
    <Sheet open={!!card} onClose={onClose} title={card?.kind === 'project' ? '編輯 Project' : '編輯任務'}>
      <div className="space-y-4">
        <Field label="標題">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="簡短描述">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>
        <Field label="截止日">
          <DueInput value={due} onChange={setDue} />
        </Field>
        <div>
          <span className="mb-1 block text-sm text-slate-500">所屬欄位</span>
          <ColumnPicker value={column} onChange={setColumn} allowDone />
        </div>
        {card?.kind === 'project' && (
          <div>
            <span className="mb-1 block text-sm text-slate-500">小任務</span>
            <TaskEditor tasks={tasks} onChange={setTasks} />
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={() => void remove()} className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-600 dark:bg-red-950 dark:text-red-300">
            刪除
          </button>
          <button onClick={() => void save()} disabled={!title.trim()} className="flex-1 rounded-xl bg-sky-500 py-3 font-medium text-white disabled:opacity-40">
            儲存
          </button>
        </div>
      </div>
    </Sheet>
  );
}
