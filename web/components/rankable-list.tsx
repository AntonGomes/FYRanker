"use client";

import { useState, useRef, useMemo, memo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { REGION_COLORS } from "@/components/job-detail-panel";

export interface RankableItem {
  id: string;
  label: string;
  badge?: string;
}

interface RankableListProps {
  items: RankableItem[];
  onReorder: (items: RankableItem[]) => void;
  title?: string;
  description?: string;
  onItemMoved?: (id: string) => void;
  searchFilter?: string;
}

/* ── Individual draggable row ── */
const DraggableRow = memo(function DraggableRow({
  item,
  index,
}: {
  item: RankableItem;
  index: number;
}) {
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

  // Derive region color from badge if it matches a known region
  const regionStyle = item.badge ? REGION_COLORS[item.badge] : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors touch-manipulation cursor-grab",
        "bg-card hover:bg-accent/50",
        rankRowClass(index),
        isDragging && "opacity-40 shadow-lg z-50"
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Rank number */}
      <span className={cn("w-7 shrink-0 text-center text-xs font-mono", rankClass(index))}>
        {index + 1}
      </span>

      {/* Label */}
      <span className="flex-1 text-sm truncate min-w-0">{item.label}</span>

      {/* Badge */}
      {item.badge && (
        <span className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium",
          regionStyle
            ? `${regionStyle.text} border ${regionStyle.border}`
            : "bg-muted text-muted-foreground"
        )}>
          {item.badge}
        </span>
      )}
    </div>
  );
});

/* ── Overlay shown while dragging ── */
const DragOverlayRow = memo(function DragOverlayRow({ item, index }: { item: RankableItem; index: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-2 py-2.5 shadow-xl ring-2 ring-primary/20 scale-[1.03]">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn("w-7 shrink-0 text-center text-xs font-mono", rankClass(index))}>
        {index + 1}
      </span>
      <span className="flex-1 text-sm truncate min-w-0">{item.label}</span>
      {item.badge && (
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {item.badge}
        </span>
      )}
    </div>
  );
});

/* ── Main component ── */
export function RankableList({
  items,
  onReorder,
  title,
  description,
  onItemMoved,
  searchFilter = "",
}: RankableListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Pre-compute O(1) index lookup map
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [items]);

  // When searching, show filtered results but maintain original indices
  const isSearching = searchFilter.length > 0;
  const filteredItems = isSearching
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
          (item.badge && item.badge.toLowerCase().includes(searchFilter.toLowerCase()))
      )
    : items;

  const scrollableItems = isSearching ? filteredItems : items;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = indexById.get(active.id as string) ?? -1;
      const newIndex = indexById.get(over.id as string) ?? -1;
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(items, oldIndex, newIndex));
        onItemMoved?.(active.id as string);
      }
    }
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
  const activeIndex = activeId ? (indexById.get(activeId) ?? -1) : -1;

  // Virtualize the scrollable section
  const virtualizer = useVirtualizer({
    count: scrollableItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 46,
    overscan: 10,
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      {(title || description) && (
        <div className="mb-3 shrink-0">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      )}

      {/* DnD context wraps both sticky and scrollable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 20 }}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* Virtualized list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-0.5">
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = scrollableItems[virtualRow.index];
                const realIndex = indexById.get(item.id) ?? 0;
                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <DraggableRow
                      item={item}
                      index={realIndex}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem ? (
            <DragOverlayRow item={activeItem} index={activeIndex} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Footer info */}
      <div className="mt-2 flex items-center text-xs text-muted-foreground border-t pt-2 shrink-0">
        <span>
          {items.length} items
          {isSearching && ` · ${filteredItems.length} shown`}
          <span className="sm:hidden"> · Hold to drag</span>
        </span>
      </div>
    </div>
  );
}
