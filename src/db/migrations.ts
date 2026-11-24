/*
 * Pure data conversions shared by the Dexie upgrade (db.ts) and the backup
 * importer (backupFormat.ts), so on-device data and old backup files are
 * converted identically. Never edit a published converter — add a new one.
 */

/** v1 → v2: weekly exercise target moved from minutes to hours. */
export function settingsV1toV2(s: Record<string, unknown>): Record<string, unknown> {
  if (!('exerciseTargetMinutes' in s)) return s;
  const { exerciseTargetMinutes, ...rest } = s;
  const mins = Number(exerciseTargetMinutes);
  // 150 was the old default → adopt the new default of 7 h; a value the user chose is converted.
  const hours = mins === 150 || !Number.isFinite(mins) || mins <= 0 ? 7 : Math.round((mins / 60) * 100) / 100;
  return { ...rest, exerciseTargetHours: hours };
}

type AnyCard = Record<string, unknown> & {
  id?: unknown;
  kind?: unknown;
  column?: unknown;
  order?: unknown;
  title?: unknown;
  tasks?: unknown;
  completedAt?: unknown;
  prevColumn?: unknown;
};
type AnyTask = { title?: unknown; done?: unknown; due?: unknown };

/**
 * v2 → v3: finished project sub-tasks no longer stay inside the project.
 * Each becomes its own card in Done (with `fromProject`), and a project whose
 * tasks are now all done moves to Done as well. Pure; ids come from `makeId`.
 */
export function splitDoneSubtasks(cards: AnyCard[], makeId: () => string, now: number): AnyCard[] {
  let top = Math.min(0, ...cards.filter((c) => c.column === 'done').map((c) => Number(c.order) || 0));
  const out: AnyCard[] = [];
  for (const c of cards) {
    const tasks = Array.isArray(c.tasks) ? (c.tasks as AnyTask[]) : [];
    if (c.kind !== 'project' || !tasks.some((t) => t?.done)) {
      out.push(c);
      continue;
    }
    const open = tasks.filter((t) => !t?.done);
    const done = tasks.filter((t) => t?.done);
    const origin = c.column === 'done' ? (c.prevColumn === 'long' ? 'long' : 'short') : c.column;
    const completedAt = typeof c.completedAt === 'number' ? c.completedAt : now;
    for (const t of done) {
      out.push({
        id: makeId(),
        kind: 'single',
        column: 'done',
        order: --top,
        title: String(t.title ?? ''),
        ...(typeof t.due === 'string' ? { due: t.due } : {}),
        tasks: [],
        completedAt,
        prevColumn: origin,
        fromProject: { id: String(c.id), title: String(c.title ?? '') },
      });
    }
    const project: AnyCard = { ...c, tasks: open };
    if (open.length === 0 && c.column !== 'done') {
      Object.assign(project, { column: 'done', prevColumn: c.column, completedAt: now, order: --top });
    }
    out.push(project);
  }
  return out;
}
