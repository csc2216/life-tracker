import { expect, it } from 'vitest';
import { settingsV1toV2 } from './migrations';

it('settingsV1toV2', () => {
  expect(settingsV1toV2({ id: 'main', exerciseTargetMinutes: 150, sleepTargetHours: 8 })).toEqual({ id: 'main', exerciseTargetHours: 7, sleepTargetHours: 8 });
  expect(settingsV1toV2({ exerciseTargetMinutes: 90 })).toEqual({ exerciseTargetHours: 1.5 });
  expect(settingsV1toV2({ exerciseTargetHours: 5 })).toEqual({ exerciseTargetHours: 5 });
});

import { splitDoneSubtasks } from './migrations';
import { describe } from 'vitest';

describe('splitDoneSubtasks', () => {
  let n = 0;
  const id = () => 'new' + n++;
  const t = (i: string, done: boolean, due?: string) => ({ id: i, title: i, done, ...(due ? { due } : {}) });

  it('leaves untouched cards alone', () => {
    const cards = [{ id: 's', kind: 'single', column: 'short', order: 0, title: 's', tasks: [] }];
    expect(splitDoneSubtasks(cards, id, 1)).toEqual(cards);
  });

  it('splits partially finished projects', () => {
    const out = splitDoneSubtasks(
      [
        { id: 'd0', kind: 'single', column: 'done', order: -3, title: 'old', tasks: [] },
        { id: 'p', kind: 'project', column: 'long', order: 0, title: 'P', tasks: [t('a', true, '2026-11-26'), t('b', false)] },
      ],
      id,
      100,
    );
    const split = out.find((c) => c.title === 'a')!;
    expect(split).toMatchObject({ kind: 'single', column: 'done', order: -4, due: '2026-11-26', prevColumn: 'long', completedAt: 100, fromProject: { id: 'p', title: 'P' } });
    expect(out.find((c) => c.id === 'p')).toMatchObject({ column: 'long', tasks: [t('b', false)] });
  });

  it('moves a fully finished project to Done', () => {
    const out = splitDoneSubtasks([{ id: 'p', kind: 'project', column: 'short', order: 0, title: 'P', tasks: [t('a', true), t('b', true)] }], id, 5);
    expect(out.filter((c) => c.fromProject)).toHaveLength(2);
    expect(out.find((c) => c.id === 'p')).toMatchObject({ column: 'done', prevColumn: 'short', tasks: [] });
  });

  it('keeps a project already in Done there, tasks pointing back to its origin', () => {
    const out = splitDoneSubtasks([{ id: 'p', kind: 'project', column: 'done', prevColumn: 'long', completedAt: 7, order: 0, title: 'P', tasks: [t('a', true)] }], id, 9);
    expect(out.find((c) => c.title === 'a')).toMatchObject({ prevColumn: 'long', completedAt: 7 });
    expect(out.find((c) => c.id === 'p')).toMatchObject({ column: 'done', tasks: [] });
  });
});
