"use client";

import { useState, memo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

function rankClass(index: number): string {
  if (index === 0) return "text-yellow-400 font-bold";
  if (index === 1) return "text-zinc-300 font-bold";
  if (index === 2) return "text-orange-400 font-bold";
  return "text-muted-foreground";
}

function rankRowClass(index: number): string {
  if (index === 0) return "ring-2 ring-yellow-400/50 bg-yellow-400/10";
  if (index === 1) return "ring-2 ring-zinc-300/40 bg-zinc-300/8";
  if (index === 2) return "ring-2 ring-orange-400/40 bg-orange-400/8";
  return "";
}

export interface SortableItem {
  id: string;
  label: string;
  badge?: string;
  regionStyle?: { bg: string; border: string; text: string };
}

interface SortableListProps {
  items: SortableItem[];
  onReorder: (items: SortableItem[]) => void;
}

function SortableRow({ item, index }: { item: SortableItem; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 touch-manipulation cursor-grab bg-card",
        rankRowClass(index),
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn("w-5 shrink-0 text-center text-xs font-mono", rankClass(index))}>
        {index + 1}
      </span>
      {item.regionStyle ? (
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold border",
          item.regionStyle.bg, item.regionStyle.border, item.regionStyle.text
        )}>
          {item.label}
        </span>
      ) : (
        <span className="flex-1 text-sm font-medium">
          {item.label}
        </span>
      )}
      {item.badge && !item.regionStyle && (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {item.badge}
        </span>
      )}
    </div>
  );
}

/* ── Overlay shown while dragging ── */
const DragOverlayRow = memo(function DragOverlayRow({ item, index }: { item: SortableItem; index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-card px-4 py-3 shadow-xl ring-2 ring-primary/20 scale-[1.03]">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn("w-5 shrink-0 text-center text-xs font-mono", rankClass(index))}>
        {index + 1}
      </span>
      {item.regionStyle ? (
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold border",
          item.regionStyle.bg, item.regionStyle.border, item.regionStyle.text
        )}>
          {item.label}
        </span>
      ) : (
        <span className="flex-1 text-sm font-medium">
          {item.label}
        </span>
      )}
      {item.badge && !item.regionStyle && (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {item.badge}
        </span>
      )}
    </div>
  );
});

export function SortableList({ items, onReorder }: SortableListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <SortableRow key={item.id} item={item} index={i} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem ? <DragOverlayRow item={activeItem} index={items.indexOf(activeItem)} /> : null}
      </DragOverlay>
    </DndContext>
    <p className="mt-2 text-center text-[11px] text-muted-foreground sm:hidden">Press and hold to drag</p>
    </>
  );
}
