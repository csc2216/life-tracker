import { db } from './db';
import type { Card, Column, Task } from './types';
import { newId } from '../lib/id';

async function edgeOrder(column: Column, edge: 'top' | 'bottom'): Promise<number> {
  const list = await db.cards.where('column').equals(column).toArray();
  if (list.length === 0) return 0;
  const orders = list.map((c) => c.order);
  return edge === 'top' ? Math.min(...orders) - 1 : Math.max(...orders) + 1;
}

export async function addCard(input: Omit<Card, 'id' | 'order'>): Promise<string> {
  const id = newId();
  await db.transaction('rw', db.cards, async () => {
    const order = await edgeOrder(input.column, input.column === 'done' ? 'top' : 'bottom');
    await db.cards.add({ ...input, id, order });
  });
  return id;
}

/** Move to Done (top of the queue), remembering where it came from. */
export async function completeCard(id: string) {
  await db.transaction('rw', db.cards, async () => {
    const c = await db.cards.get(id);
    if (!c || c.column === 'done') return;
    await db.cards.update(id, {
      column: 'done',
      prevColumn: c.column,
      completedAt: Date.now(),
      order: await edgeOrder('done', 'top'),
    });
  });
}

/**
 * Back from Done to the column it came from (top, since it needs doing now).
 * A finished sub-task goes back into its project (and the project leaves Done too);
 * if the project was deleted it becomes a normal single card.
 */
export async function reopenCard(id: string, to?: Exclude<Column, 'done'>) {
  await db.transaction('rw', db.cards, async () => {
    const c = await db.cards.get(id);
    if (!c || c.column !== 'done') return;
    const project = c.fromProject && (await db.cards.get(c.fromProject.id));
    if (project && project.kind === 'project') {
      const task: Task = { id: newId(), title: c.title, done: false, ...(c.due ? { due: c.due } : {}) };
      await db.cards.update(project.id, { tasks: [...project.tasks, task] });
      await db.cards.delete(id);
      if (project.column === 'done') {
        const column = project.prevColumn ?? 'short';
        await db.cards.update(project.id, { column, completedAt: undefined, order: await edgeOrder(column, 'top') });
      }
      return;
    }
    const column = to ?? c.prevColumn ?? 'short';
    await db.cards.update(id, { column, completedAt: undefined, fromProject: undefined, order: await edgeOrder(column, 'top') });
  });
}

/**
 * Tick a project sub-task: it leaves the project and becomes its own card at the
 * top of Done. If it was the last open task, the project moves to Done too.
 */
export async function completeSubtask(projectId: string, taskId: string): Promise<{ cardId: string; projectDone: boolean } | undefined> {
  return db.transaction('rw', db.cards, async () => {
    const p = await db.cards.get(projectId);
    const task = p?.tasks.find((t) => t.id === taskId);
    if (!p || !task) return undefined;
    const now = Date.now();
    const origin = p.column === 'done' ? (p.prevColumn ?? 'short') : p.column;
    const cardId = newId();
    await db.cards.add({
      id: cardId,
      kind: 'single',
      column: 'done',
      order: await edgeOrder('done', 'top'),
      title: task.title,
      ...(task.due ? { due: task.due } : {}),
      tasks: [],
      completedAt: now,
      prevColumn: origin,
      fromProject: { id: p.id, title: p.title },
    });
    const rest = p.tasks.filter((t) => t.id !== taskId);
    await db.cards.update(projectId, { tasks: rest });
    const projectDone = rest.length === 0 && p.column !== 'done';
    if (projectDone) {
      await db.cards.update(projectId, { column: 'done', prevColumn: origin, completedAt: now, order: await edgeOrder('done', 'top') });
    }
    return { cardId, projectDone };
  });
}

/** Save edits from the edit sheet; column changes go through complete/reopen semantics. */
export async function saveCard(id: string, patch: Pick<Card, 'title' | 'description' | 'due' | 'tasks' | 'column'>) {
  const c = await db.cards.get(id);
  if (!c) return;
  const { column, ...rest } = patch;
  const ticked = c.kind === 'project' ? rest.tasks.filter((t) => t.done) : [];
  await db.cards.update(id, rest);
  for (const t of ticked) await completeSubtask(id, t.id);
  if (ticked.length) {
    const after = await db.cards.get(id);
    if (!after || after.column === 'done') return;
  }
  if (column === c.column) return;
  if (column === 'done') await completeCard(id);
  else if (c.column === 'done') await reopenCard(id, column);
  else {
    await db.transaction('rw', db.cards, async () => {
      await db.cards.update(id, { column, order: await edgeOrder(column, 'bottom') });
    });
  }
}

export async function setColumnOrder(ids: string[]) {
  await db.transaction('rw', db.cards, async () => {
    await Promise.all(ids.map((id, i) => db.cards.update(id, { order: i })));
  });
}

/** Turn a single card into a sub-task of a project. Returns an undo function. */
export async function mergeIntoProject(singleId: string, projectId: string): Promise<(() => Promise<void>) | undefined> {
  return db.transaction('rw', db.cards, async () => {
    const single = await db.cards.get(singleId);
    const project = await db.cards.get(projectId);
    if (!single || !project || single.kind !== 'single' || project.kind !== 'project') return undefined;
    const task: Task = { id: newId(), title: single.title, done: false, ...(single.due ? { due: single.due } : {}) };
    await db.cards.update(projectId, { tasks: [...project.tasks, task] });
    await db.cards.delete(singleId);
    return async () => {
      await db.transaction('rw', db.cards, async () => {
        const p = await db.cards.get(projectId);
        if (p) await db.cards.update(projectId, { tasks: p.tasks.filter((t) => t.id !== task.id) });
        await db.cards.put(single);
      });
    };
  });
}

/** Reorder a project's sub-tasks to match `taskIds` (unknown ids ignored, missing ones kept at the end). */
export async function reorderTasks(projectId: string, taskIds: string[]) {
  await db.transaction('rw', db.cards, async () => {
    const p = await db.cards.get(projectId);
    if (!p) return;
    const byId = new Map(p.tasks.map((t) => [t.id, t]));
    const ordered = taskIds.map((id) => byId.get(id)).filter((t): t is Task => !!t);
    const rest = p.tasks.filter((t) => !taskIds.includes(t.id));
    await db.cards.update(projectId, { tasks: [...ordered, ...rest] });
  });
}

export async function deleteCard(id: string) {
  await db.cards.delete(id);
}
