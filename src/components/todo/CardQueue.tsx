import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { mergeIntoProject, reorderTasks, setColumnOrder } from '../../db/cardOps';
import type { Card } from '../../db/types';
import CardItem from './CardItem';
import CardView, { TaskRowView } from './CardView';

/**
 * Route collisions by what is being dragged:
 * - a sub-task only sorts among the other sub-tasks of its own project;
 * - a single card merges when over a project's task area, otherwise sorts among cards;
 * - a project only sorts among cards.
 */
const collision: CollisionDetection = (args) => {
  const data = args.active.data.current;
  const all = args.droppableContainers;
  if (data?.type === 'task') {
    const siblings = all.filter((c) => c.data.current?.type === 'task' && c.data.current.projectId === data.projectId);
    return closestCenter({ ...args, droppableContainers: siblings });
  }
  const cards = all.filter((c) => c.data.current?.type === 'card');
  if ((data?.card as Card | undefined)?.kind === 'single') {
    const hits = pointerWithin({ ...args, droppableContainers: all.filter((c) => String(c.id).startsWith('into:')) });
    if (hits.length) return hits;
  }
  return closestCenter({ ...args, droppableContainers: cards });
};

/** Ignore the click that some browsers fire right after a drag ends. */
let lastDragEnd = 0;

function SortableCard({ card, today, onOpen, onCompleted }: { card: Card; today: string; onOpen: () => void; onCompleted: (title: string, undoId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { type: 'card', card } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
    >
      <CardItem
        card={card}
        today={today}
        dropZone={card.kind === 'project'}
        sortableTasks={card.kind === 'project'}
        onOpen={() => Date.now() - lastDragEnd > 250 && onOpen()}
        onCompleted={onCompleted}
      />
    </div>
  );
}

interface Props {
  cards: Card[]; // already sorted for this column
  today: string;
  onOpen: (c: Card) => void;
  onCompleted: (title: string, undoId: string) => void;
  onMerged: (title: string, projectTitle: string, undo: () => Promise<void>) => void;
  onDraggingChange: (dragging: boolean) => void;
}

export default function CardQueue({ cards, today, onOpen, onCompleted, onMerged, onDraggingChange }: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  // optimistic order so the list doesn't jump back for a frame after dropping
  const [optimistic, setOptimistic] = useState<string[] | null>(null);
  // same for a project's sub-tasks
  const [optimisticTasks, setOptimisticTasks] = useState<{ projectId: string; ids: string[] } | null>(null);
  useEffect(() => {
    setOptimistic(null);
    setOptimisticTasks(null);
  }, [cards]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const ids = optimistic ?? cards.map((c) => c.id);
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((c): c is Card => !!c)
    .map((c) => {
      if (optimisticTasks?.projectId !== c.id) return c;
      const pos = new Map(optimisticTasks.ids.map((id, i) => [id, i]));
      const tasks = [...c.tasks].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
      return { ...c, tasks };
    });
  const active = activeId ? byId.get(activeId) : undefined;
  const [activeTask, setActiveTask] = useState<{ task: Card['tasks'][number] } | null>(null);

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current;
    if (d?.type === 'task') setActiveTask({ task: d.task });
    else setActiveId(String(e.active.id));
    onDraggingChange(true);
    navigator.vibrate?.(10);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    setActiveTask(null);
    lastDragEnd = Date.now();
    setTimeout(() => onDraggingChange(false), 50);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || overId === e.active.id) return;
    const d = e.active.data.current;
    if (d?.type === 'task') {
      // Move within the project's full task list, so folded (+N) tasks keep their places.
      const project = byId.get(d.projectId as string);
      const over = e.over?.data.current;
      if (!project || over?.type !== 'task') return;
      const ids = project.tasks.map((t) => t.id);
      const from = ids.indexOf(d.task.id);
      const to = ids.indexOf(over.task.id);
      if (from < 0 || to < 0) return;
      const next = arrayMove(ids, from, to);
      setOptimisticTasks({ projectId: project.id, ids: next });
      await reorderTasks(project.id, next);
      return;
    }
    if (overId.startsWith('into:')) {
      const projectId = overId.slice(5);
      const single = byId.get(String(e.active.id));
      const project = byId.get(projectId);
      const undo = await mergeIntoProject(String(e.active.id), projectId);
      if (undo && single && project) onMerged(single.title, project.title, undo);
      return;
    }
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setOptimistic(next);
    await setColumnOrder(next);
  };

  if (cards.length === 0) {
    return <p className="py-12 text-center text-slate-500">這裡還沒有卡片</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={() => {
        setActiveId(null);
        setActiveTask(null);
        onDraggingChange(false);
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {ordered.map((c) => (
          <SortableCard key={c.id} card={c} today={today} onOpen={() => onOpen(c)} onCompleted={onCompleted} />
        ))}
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
        {active && <CardView card={active} today={today} lifted />}
        {activeTask && <TaskRowView task={activeTask.task} ticked={activeTask.task.done} today={today} lifted />}
      </DragOverlay>
    </DndContext>
  );
}
