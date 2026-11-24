import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { completeCard, completeSubtask, reopenCard } from '../../db/cardOps';
import type { Card } from '../../db/types';
import CardView from './CardView';

const PAUSE_MS = 450;

interface Props {
  card: Card;
  today: string;
  dropZone?: boolean;
  sortableTasks?: boolean;
  tasksOverride?: Card['tasks'];
  /** slide out before moving to Done (queue view); filtered view just updates in place */
  animateOut?: boolean;
  onOpen: () => void;
  /** something was finished; `undoId` is the Done card to reopen for undo */
  onCompleted?: (title: string, undoId: string) => void;
}

/**
 * Card + completion behaviour.
 * Single: check → strike → slide out → Done.
 * Project sub-task: check → strike → the task moves to Done on its own;
 * ticking the last one also slides the project out to Done.
 */
export default function CardItem({ card, today, dropZone, sortableTasks, tasksOverride, animateOut = true, onOpen, onCompleted }: Props) {
  const [completing, setCompleting] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState(false);
  const afterLeave = useRef<() => Promise<void>>(async () => {});

  const leaveThen = async (action: () => Promise<void>) => {
    if (animateOut) {
      afterLeave.current = action;
      setLeaving(true);
    } else {
      await action();
    }
  };

  const onToggleSingle = () => {
    if (completing) return;
    if (card.column === 'done') {
      void reopenCard(card.id);
      return;
    }
    setCompleting(true);
    setTimeout(() => {
      void leaveThen(async () => {
        await completeCard(card.id);
        onCompleted?.(card.title, card.id);
        setCompleting(false);
      });
    }, PAUSE_MS);
  };

  const onToggleTask = (taskId: string) => {
    const task = card.tasks.find((t) => t.id === taskId);
    if (!task || pending.has(taskId) || leaving) return;
    const openLeft = card.tasks.filter((t) => !t.done && !pending.has(t.id) && t.id !== taskId).length;
    setPending((s) => new Set(s).add(taskId));
    const run = async () => {
      const r = await completeSubtask(card.id, taskId);
      if (r) onCompleted?.(task.title, r.cardId);
      setPending((s) => {
        const n = new Set(s);
        n.delete(taskId);
        return n;
      });
    };
    setTimeout(() => {
      if (openLeft === 0 && card.column !== 'done') void leaveThen(run);
      else void run();
    }, PAUSE_MS);
  };

  return (
    <motion.div
      initial={false}
      animate={leaving ? { opacity: 0, x: 120, height: 0 } : { opacity: 1, x: 0, height: 'auto' }}
      transition={{ duration: 0.35, ease: 'easeIn' }}
      onAnimationComplete={() => leaving && void afterLeave.current()}
      className={leaving ? 'overflow-hidden' : ''}
    >
      <div className="pb-3">
        <CardView
          card={card}
          today={today}
          completing={completing}
          pendingTasks={pending}
          tasksOverride={tasksOverride}
          dropZone={dropZone}
          sortableTasks={sortableTasks}
          onOpen={onOpen}
          onToggleSingle={onToggleSingle}
          onToggleTask={onToggleTask}
        />
      </div>
    </motion.div>
  );
}
