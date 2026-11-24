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
import { mergeIntoProject, setColumnOrder } from '../../db/cardOps';
import type { Card } from '../../db/types';
import CardItem from './CardItem';
import CardView from './CardView';

/** Single cards dragged over a project's task area merge into it; otherwise sort. */
const collision: CollisionDetection = (args) => {
  const active = args.active.data.current?.card as Card | undefined;
  const isInto = (id: unknown) => String(id).startsWith('into:');
  if (active?.kind === 'single') {
    const hits = pointerWithin({ ...args, droppableContainers: args.droppableContainers.filter((c) => isInto(c.id)) });
    if (hits.length) return hits;
  }
  return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => !isInto(c.id)) });
};

/** Ignore the click that some browsers fire right after a drag ends. */
let lastDragEnd = 0;

function SortableCard({ card, today, onOpen, onCompleted }: { card: Card; today: string; onOpen: () => void; onCompleted: (title: string, undoId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { card } });
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
  useEffect(() => setOptimistic(null), [cards]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const ids = optimistic ?? cards.map((c) => c.id);
  const ordered = ids.map((id) => byId.get(id)).filter((c): c is Card => !!c);
  const active = activeId ? byId.get(activeId) : undefined;

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    onDraggingChange(true);
    navigator.vibrate?.(10);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    lastDragEnd = Date.now();
    setTimeout(() => onDraggingChange(false), 50);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || overId === e.active.id) return;
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
      </DragOverlay>
    </DndContext>
  );
}
