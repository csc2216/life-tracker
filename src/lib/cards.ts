import type { Card, Column, Task } from '../db/types';

export const COLUMNS: { id: Column; label: string }[] = [
  { id: 'long', label: 'Long term' },
  { id: 'short', label: 'Short term' },
  { id: 'done', label: 'Done' },
];

export const PREVIEW_TASKS = 3;

/** `finished` = sub-tasks of this project already moved to Done. */
export function progress(c: Card, finished = 0): { done: number; total: number } {
  const doneInside = c.tasks.filter((t) => t.done).length;
  return { done: finished + doneInside, total: finished + c.tasks.length };
}

/** projectId → number of its finished sub-tasks sitting in Done */
export function finishedCounts(cards: Card[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cards) if (c.fromProject) m.set(c.fromProject.id, (m.get(c.fromProject.id) ?? 0) + 1);
  return m;
}

/** A project is complete when it has tasks and all are done. */
export function isProjectComplete(c: Card): boolean {
  return c.kind === 'project' && c.tasks.length > 0 && c.tasks.every((t) => t.done);
}

export function isCardDone(c: Card): boolean {
  return c.kind === 'single' ? c.column === 'done' : isProjectComplete(c) || c.column === 'done';
}

/**
 * Collapsed: up to 3 unfinished tasks, everything else folded into "+N 項".
 * Expanded: unfinished first, then finished.
 */
export function visibleTasks(c: Card, expanded: boolean): { shown: Task[]; hidden: number } {
  const open = c.tasks.filter((t) => !t.done);
  const done = c.tasks.filter((t) => t.done);
  if (expanded) return { shown: [...open, ...done], hidden: 0 };
  const shown = open.slice(0, PREVIEW_TASKS);
  return { shown, hidden: c.tasks.length - shown.length };
}

export function sortByOrder(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function columnCards(cards: Card[], col: Column): Card[] {
  return sortByOrder(cards.filter((c) => c.column === col));
}

export interface DueMark {
  done: boolean;
}

/** Every dated thing (single card, project, or project sub-task) per day. */
export function dueMarks(cards: Card[]): Map<string, DueMark[]> {
  const m = new Map<string, DueMark[]>();
  const push = (day: string, done: boolean) => {
    const list = m.get(day) ?? [];
    list.push({ done });
    m.set(day, list);
  };
  for (const c of cards) {
    if (c.due) push(c.due, isCardDone(c));
    if (c.kind === 'project') for (const t of c.tasks) if (t.due) push(t.due, t.done || c.column === 'done');
  }
  return m;
}

/** Cards with anything due on `day`; projects keep only the tasks due that day (unless the project itself is due). */
export function cardsDueOn(cards: Card[], day: string): { card: Card; tasks: Task[] }[] {
  const out: { card: Card; tasks: Task[] }[] = [];
  for (const c of sortByOrder(cards)) {
    const tasks = c.tasks.filter((t) => t.due === day);
    if (c.due === day) out.push({ card: c, tasks: c.tasks });
    else if (tasks.length) out.push({ card: c, tasks });
  }
  const rank = (c: Card) => (isCardDone(c) ? 1 : 0);
  return out.sort((a, b) => rank(a.card) - rank(b.card));
}

export type DueStatus = 'done' | 'overdue' | 'today' | 'upcoming';

export function dueStatus(due: string, today: string, done: boolean): DueStatus {
  if (done) return 'done';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'upcoming';
}
