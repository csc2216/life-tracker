import { describe, expect, it } from 'vitest';
import type { Card, Task } from '../db/types';
import { cardsDueOn, dueMarks, dueStatus, finishedCounts, isCardDone, isProjectComplete, progress, visibleTasks } from './cards';
import { weekDays, weekStartKey } from './week';

const task = (id: string, done = false, due?: string): Task => ({ id, title: id, done, due });
const card = (p: Partial<Card>): Card => ({ id: 'c', kind: 'single', column: 'short', order: 0, title: 't', tasks: [], ...p });

describe('project helpers', () => {
  const proj = card({ kind: 'project', tasks: [task('a', true), task('b'), task('c'), task('d'), task('e')] });

  it('progress and completion', () => {
    expect(progress(proj)).toEqual({ done: 1, total: 5 });
    expect(isProjectComplete(proj)).toBe(false);
    expect(isProjectComplete(card({ kind: 'project', tasks: [] }))).toBe(false);
    expect(isProjectComplete(card({ kind: 'project', tasks: [task('a', true)] }))).toBe(true);
  });

  it('counts sub-tasks already moved to Done', () => {
    const p = card({ id: 'p', kind: 'project', tasks: [task('b'), task('c')] });
    const done = [card({ id: 'x', column: 'done', fromProject: { id: 'p', title: 't' } }), card({ id: 'y', column: 'done', fromProject: { id: 'p', title: 't' } })];
    const n = finishedCounts([p, ...done]).get('p');
    expect(n).toBe(2);
    expect(progress(p, n)).toEqual({ done: 2, total: 4 });
  });

  it('shows at most 3 unfinished tasks when collapsed', () => {
    const v = visibleTasks(proj, false);
    expect(v.shown.map((t) => t.id)).toEqual(['b', 'c', 'd']);
    expect(v.hidden).toBe(2);
    const e = visibleTasks(proj, true);
    expect(e.shown.map((t) => t.id)).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(e.hidden).toBe(0);
  });

  it('single cards are done only in the Done column', () => {
    expect(isCardDone(card({}))).toBe(false);
    expect(isCardDone(card({ column: 'done' }))).toBe(true);
  });
});

describe('due dates', () => {
  const cards = [
    card({ id: 's', due: '2026-11-26' }),
    card({ id: 'p', kind: 'project', tasks: [task('x', false, '2026-11-26'), task('y', true, '2026-11-27'), task('z')] }),
    card({ id: 'd', column: 'done', due: '2026-11-26' }),
  ];

  it('collects marks for cards and sub-tasks', () => {
    const m = dueMarks(cards);
    expect(m.get('2026-11-26')).toEqual([{ done: false }, { done: false }, { done: true }]);
    expect(m.get('2026-11-27')).toEqual([{ done: true }]);
  });

  it('filters a day, keeping only matching sub-tasks, done last', () => {
    const r = cardsDueOn(cards, '2026-11-26');
    expect(r.map((x) => x.card.id)).toEqual(['s', 'p', 'd']);
    expect(r[1].tasks.map((t) => t.id)).toEqual(['x']);
  });

  it('dueStatus', () => {
    expect(dueStatus('2026-11-20', '2026-11-24', false)).toBe('overdue');
    expect(dueStatus('2026-11-24', '2026-11-24', false)).toBe('today');
    expect(dueStatus('2026-11-30', '2026-11-24', false)).toBe('upcoming');
    expect(dueStatus('2026-11-20', '2026-11-24', true)).toBe('done');
  });
});

describe('week', () => {
  it('starts on Monday', () => {
    expect(weekStartKey('2026-11-24')).toBe('2026-11-23'); // Tue → Mon
    expect(weekStartKey('2026-11-29')).toBe('2026-11-23'); // Sun → previous Mon
    expect(weekDays('2026-11-30')[6]).toBe('2026-12-06');
    const two = weekDays('2026-11-23', 14);
    expect(two).toHaveLength(14);
    expect(two[7]).toBe('2026-11-30');
    expect(two[13]).toBe('2026-12-06');
  });
});
