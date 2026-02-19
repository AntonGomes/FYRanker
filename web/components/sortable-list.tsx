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
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

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

function SortableRow({ item }: { item: SortableItem }) {
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
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        item.regionStyle
          ? `${item.regionStyle.bg} ${item.regionStyle.border}`
          : "bg-card",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className={cn(
        "flex-1 text-sm font-medium",
        item.regionStyle?.text
      )}>
        {item.label}
      </span>
      {item.badge && (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {item.badge}
        </span>
      )}
    </div>
  );
}

/* ── Overlay shown while dragging ── */
const DragOverlayRow = memo(function DragOverlayRow({ item }: { item: SortableItem }) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-xl ring-2 ring-primary/20 scale-[1.03]",
      item.regionStyle
        ? `${item.regionStyle.bg} ${item.regionStyle.border}`
        : "bg-card border-primary/40",
    )}>
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className={cn("flex-1 text-sm font-medium", item.regionStyle?.text)}>
        {item.label}
      </span>
      {item.badge && (
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
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem ? <DragOverlayRow item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
