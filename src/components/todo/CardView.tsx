import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type ReactNode } from 'react';
import type { Card, Task } from '../../db/types';
import { isProjectComplete, progress, visibleTasks } from '../../lib/cards';
import DueChip from './DueChip';
import { useFinished } from './finished';

interface Props {
  card: Card;
  today: string;
  /** force checked look while the completion animation plays */
  completing?: boolean;
  /** sub-tasks shown ticked while they animate out */
  pendingTasks?: Set<string>;
  /** show exactly these tasks (filtered-by-day view) */
  tasksOverride?: Task[];
  /** register the task area as a drop zone for merging single cards */
  dropZone?: boolean;
  /** make sub-tasks drag-sortable (queue view only; needs the surrounding DndContext) */
  sortableTasks?: boolean;
  lifted?: boolean;
  onOpen?: () => void;
  onToggleSingle?: () => void;
  onToggleTask?: (taskId: string) => void;
}

function Check({ checked, onClick, label, size = 'md' }: { checked: boolean; onClick?: () => void; label: string; size?: 'md' | 'sm' }) {
  const dim = size === 'md' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'
      }`}
    >
      {checked && <span className="text-xs leading-none">✓</span>}
    </button>
  );
}

/** dnd-kit id for a sub-task row (prefixed so it can't clash with card ids). */
export const taskDndId = (taskId: string) => `task:${taskId}`;

export function TaskRowView({ task, ticked, today, lifted, onToggle }: { task: Task; ticked: boolean; today: string; lifted?: boolean; onToggle?: () => void }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 select-none [-webkit-touch-callout:none] dark:border-slate-700 dark:bg-slate-900 ${
        lifted ? 'ui-card ui-lifted scale-[1.03] shadow-xl' : ''
      }`}
    >
      <Check size="sm" checked={ticked} onClick={onToggle} label={`完成 ${task.title}`} />
      <span className={`min-w-0 flex-1 break-words text-sm ${ticked ? 'text-slate-400 line-through' : ''}`}>{task.title}</span>
      {task.due && <DueChip due={task.due} today={today} done={ticked} />}
    </div>
  );
}

/** Long-pressing a sub-task drags just the sub-task; dnd-kit lets the innermost draggable claim the press. */
function SortableTaskRow({ projectId, task, ...rest }: { projectId: string; task: Task; ticked: boolean; today: string; onToggle?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskDndId(task.id),
    data: { type: 'task', projectId, task },
  });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} {...attributes} {...listeners} role="listitem">
      <TaskRowView task={task} {...rest} />
    </div>
  );
}

function DropZone({ id, disabled, children }: { id: string; disabled: boolean; children: (isOver: boolean) => ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `into:${id}`, disabled });
  return <div ref={setNodeRef}>{children(isOver)}</div>;
}

export default function CardView({ card, today, completing, pendingTasks, tasksOverride, dropZone, sortableTasks, lifted, onOpen, onToggleSingle, onToggleTask }: Props) {
  const [expanded, setExpanded] = useState(false);
  const finished = useFinished(card.id);
  const inDone = card.column === 'done';
  const shell = `ui-card select-none rounded-2xl bg-white dark:bg-slate-900 transition-shadow [-webkit-touch-callout:none] ${
    lifted ? 'ui-lifted scale-[1.03] shadow-2xl ring-1 ring-black/5' : 'shadow-sm'
  }`;

  if (card.kind === 'single') {
    const checked = inDone || !!completing;
    return (
      <div className={`${shell} flex items-start gap-3 px-4 py-3.5`} onClick={onOpen}>
        <div className="pt-0.5">
          <Check checked={checked} onClick={onToggleSingle} label={`完成 ${card.title}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`break-words ${checked ? 'text-slate-400 line-through' : ''}`}>{card.title}</p>
          {card.fromProject && (
            <span className="mt-1 inline-block rounded-md bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              {card.fromProject.title}
            </span>
          )}
          {card.description && <p className="mt-0.5 truncate text-sm text-slate-500">{card.description}</p>}
        </div>
        {card.due && <DueChip due={card.due} today={today} done={checked} />}
      </div>
    );
  }

  const { done, total } = progress(card, finished);
  const complete = isProjectComplete(card) || !!completing || (inDone && card.tasks.length === 0);
  // Long term is a "write one, do one" list: no progress there.
  const showProgress = card.column !== 'long' && total > 0;
  const view = tasksOverride ? { shown: tasksOverride, hidden: 0 } : visibleTasks(card, expanded);

  const taskList = (isOver: boolean) => (
    <div className={`mt-3 space-y-1.5 rounded-xl transition-colors ${isOver ? 'bg-sky-50 ring-2 ring-sky-400 dark:bg-sky-950' : ''}`}>
      {sortableTasks ? (
        <SortableContext items={view.shown.map((t) => taskDndId(t.id))} strategy={verticalListSortingStrategy}>
          {view.shown.map((t) => (
            <SortableTaskRow
              key={t.id}
              projectId={card.id}
              task={t}
              ticked={t.done || !!pendingTasks?.has(t.id)}
              today={today}
              onToggle={() => onToggleTask?.(t.id)}
            />
          ))}
        </SortableContext>
      ) : (
        view.shown.map((t) => (
          <TaskRowView key={t.id} task={t} ticked={t.done || !!pendingTasks?.has(t.id)} today={today} onToggle={() => onToggleTask?.(t.id)} />
        ))
      )}
      {card.tasks.length === 0 &&
        (finished > 0 ? (
          <p className="px-1 py-1 text-sm text-emerald-600 dark:text-emerald-400">小任務都完成了</p>
        ) : (
          <p className="px-1 py-1 text-sm text-slate-400">還沒有小任務，點卡片新增</p>
        ))}
      {view.hidden > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="w-full rounded-xl py-1.5 text-sm text-sky-600 dark:text-sky-400"
        >
          ＋{view.hidden} 項
        </button>
      )}
      {expanded && !tasksOverride && total > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="w-full py-1 text-sm text-slate-500"
        >
          收合
        </button>
      )}
      {isOver && <p className="pb-1 text-center text-sm font-medium text-sky-600">放開以加入此 Project</p>}
    </div>
  );

  return (
    <div className={`${shell} border-l-4 px-4 py-3.5 ${complete ? 'border-emerald-500' : 'border-sky-500'}`} onClick={onOpen}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-semibold break-words ${complete && !inDone ? 'text-emerald-600' : ''}`}>{card.title}</p>
          {card.description && <p className="mt-0.5 truncate text-sm text-slate-500">{card.description}</p>}
        </div>
        {card.due && <DueChip due={card.due} today={today} done={complete} />}
        {showProgress && (
          <span className="shrink-0 font-mono text-sm text-slate-500 tabular-nums">
            {done}/{total}
          </span>
        )}
      </div>
      {showProgress && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      {dropZone ? <DropZone id={card.id} disabled={inDone}>{taskList}</DropZone> : taskList(false)}
    </div>
  );
}
