import { AnimatePresence, motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useRef, useState } from 'react';
import Toast, { type ToastState } from '../components/Toast';
import AddCardSheet from '../components/todo/AddCardSheet';
import CardEditSheet from '../components/todo/CardEditSheet';
import CardItem from '../components/todo/CardItem';
import CardQueue from '../components/todo/CardQueue';
import { FinishedCounts } from '../components/todo/finished';
import QueueTabs from '../components/todo/QueueTabs';
import WeekStrip from '../components/todo/WeekStrip';
import { reopenCard } from '../db/cardOps';
import { db } from '../db/db';
import type { Card, Column } from '../db/types';
import { cardsDueOn, columnCards, dueMarks, finishedCounts } from '../lib/cards';
import { dateKey, dayLabel } from '../lib/time';
import { useNow } from '../lib/useNow';
import { weekStartKey } from '../lib/week';

const COL_ORDER: Column[] = ['long', 'short', 'done'];
const COL_LABEL: Record<Column, string> = { long: 'Long', short: 'Short', done: 'Done' };

export default function TodoPage() {
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? [];
  const now = useNow(60_000);
  const today = dateKey(now);

  const [week, setWeek] = useState(() => weekStartKey(today));
  const [day, setDay] = useState<string | null>(null);
  const [tab, setTab] = useState<Column>('short');
  const [dir, setDir] = useState(0);
  const [editing, setEditing] = useState<Card | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const dragging = useRef(false);

  const marks = useMemo(() => dueMarks(cards), [cards]);
  const finished = useMemo(() => finishedCounts(cards), [cards]);
  const counts = useMemo(
    () => Object.fromEntries(COL_ORDER.map((c) => [c, cards.filter((x) => x.column === c).length])) as Record<Column, number>,
    [cards],
  );
  const clearToast = useCallback(() => setToast(null), []);

  const goTab = (c: Column) => {
    setDir(COL_ORDER.indexOf(c) > COL_ORDER.indexOf(tab) ? 1 : -1);
    setTab(c);
  };
  const swipe = (delta: number) => {
    const i = COL_ORDER.indexOf(tab) + delta;
    if (i >= 0 && i < COL_ORDER.length) goTab(COL_ORDER[i]);
  };

  const onCompleted = (title: string, undoId: string) =>
    setToast({ key: Date.now(), message: `已完成「${title}」`, onUndo: () => void reopenCard(undoId) });
  const onMerged = (title: string, project: string, undo: () => Promise<void>) =>
    setToast({ key: Date.now(), message: `「${title}」已加入 ${project}`, onUndo: () => void undo() });

  const filtered = day ? cardsDueOn(cards, day) : [];

  return (
    <FinishedCounts.Provider value={finished}>
    <div className="space-y-4 px-4 pt-4">
      <h1 className="text-2xl font-bold">待辦</h1>

      <WeekStrip start={week} today={today} selected={day} marks={marks} onSelect={setDay} onWeek={setWeek} />

      {day ? (
        <div>
          <div className="mb-3 flex items-center px-1">
            <h2 className="flex-1 font-semibold">
              {dayLabel(day, now)}到期 · {filtered.length} 項
            </h2>
            <button onClick={() => setDay(null)} className="rounded-full px-3 py-1 text-sm text-sky-600 dark:text-sky-400">
              顯示全部
            </button>
          </div>
          {filtered.length === 0 && <p className="py-10 text-center text-slate-500">這天沒有到期的任務</p>}
          {filtered.map(({ card, tasks }) => (
            <div key={card.id} className="relative">
              <span className="absolute -top-2 right-3 z-10 rounded-full bg-slate-200 px-2 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {COL_LABEL[card.column]}
              </span>
              <CardItem
                card={card}
                today={today}
                tasksOverride={card.kind === 'project' ? tasks : undefined}
                animateOut={false}
                onOpen={() => setEditing(card)}
                onCompleted={onCompleted}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <QueueTabs value={tab} counts={counts} onChange={goTab} />
          <motion.div
            className="min-h-[50vh] overflow-x-clip"
            style={{ touchAction: 'pan-y' }}
            onPanEnd={(_, info) => {
              if (dragging.current) return;
              if (Math.abs(info.offset.x) > 60 && Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.5) {
                swipe(info.offset.x < 0 ? 1 : -1);
              }
            }}
          >
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={tab}
                custom={dir}
                variants={{
                  enter: (d: number) => ({ x: `${d * 100}%`, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (d: number) => ({ x: `${-d * 100}%`, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              >
                <CardQueue
                  cards={columnCards(cards, tab)}
                  today={today}
                  onOpen={setEditing}
                  onCompleted={onCompleted}
                  onMerged={onMerged}
                  onDraggingChange={(d) => (dragging.current = d)}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>
          <p className="pr-20 pb-2 text-xs text-slate-400">按住卡片拖曳排序 · 左右滑動換頁</p>
        </>
      )}

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setAdding(true)}
        aria-label="新增"
        className="fixed right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-3xl text-white shadow-lg"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        ＋
      </motion.button>

      <AddCardSheet open={adding} defaultColumn={tab === 'long' ? 'long' : 'short'} defaultDue={day ?? undefined} onClose={() => setAdding(false)} />
      <CardEditSheet card={editing} onClose={() => setEditing(null)} />
      <Toast toast={toast} onDone={clearToast} />
    </div>
    </FinishedCounts.Provider>
  );
}
