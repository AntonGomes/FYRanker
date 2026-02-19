"use client";

import { useState, useCallback, useRef, useMemo, memo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import {
  Search,
  Lock,
  Unlock,
  GripVertical,
} from "lucide-react";
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
  stickyCount?: number;
  onItemMoved?: (id: string) => void;
}

/* ── Individual draggable row ── */
const DraggableRow = memo(function DraggableRow({
  item,
  index,
  isPinned,
  isSticky,
  editingIndex,
  editValue,
  onEditStart,
  onEditChange,
  onEditKeyDown,
  onEditBlur,
  onTogglePin,
}: {
  item: RankableItem;
  index: number;
  isPinned: boolean;
  isSticky: boolean;
  editingIndex: number | null;
  editValue: string;
  onEditStart: (index: number) => void;
  onEditChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, index: number) => void;
  onEditBlur: () => void;
  onTogglePin: (id: string) => void;
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
      className={cn(
        "group flex items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors",
        regionStyle
          ? `${regionStyle.bg} ${regionStyle.border}`
          : isPinned
            ? "bg-primary/5 border-primary/20"
            : "bg-card hover:bg-accent/50",
        isDragging && "opacity-40 shadow-lg z-50",
        isSticky && "bg-card/95 backdrop-blur-sm"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0 p-1"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Rank number (click to edit) */}
      {editingIndex === index ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => onEditKeyDown(e, index)}
          onBlur={onEditBlur}
          autoFocus
          className="w-9 rounded border bg-background px-1 py-0.5 text-center text-xs font-mono outline-none focus:ring-1 focus:ring-ring"
        />
      ) : (
        <button
          onClick={() => onEditStart(index)}
          className="w-9 shrink-0 text-center text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted rounded py-0.5 transition-colors"
          title="Click to type a new position"
        >
          {index + 1}
        </button>
      )}

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

      {/* Pin */}
      <button
        onClick={() => onTogglePin(item.id)}
        className={cn(
          "p-0.5 transition-colors opacity-0 group-hover:opacity-100",
          isPinned
            ? "text-primary opacity-100"
            : "text-muted-foreground hover:text-foreground"
        )}
        title={isPinned ? "Unlock position" : "Lock position"}
      >
        {isPinned ? (
          <Lock className="h-3.5 w-3.5" />
        ) : (
          <Unlock className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
});

/* ── Overlay shown while dragging ── */
const DragOverlayRow = memo(function DragOverlayRow({ item, index }: { item: RankableItem; index: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-2 py-2.5 shadow-xl ring-2 ring-primary/20 scale-[1.03]">
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="w-9 shrink-0 text-center text-xs font-mono text-muted-foreground">
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
  stickyCount = 5,
  onItemMoved,
}: RankableListProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
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
  const isSearching = search.length > 0;
  const filteredItems = isSearching
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          (item.badge && item.badge.toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  // For display: sticky top N items + rest
  const stickyItems = isSearching ? [] : items.slice(0, Math.min(stickyCount, items.length));
  const scrollableItems = isSearching ? filteredItems : items.slice(stickyCount);

  // Stabilized callbacks
  const handleEditStart = useCallback((idx: number) => {
    setEditingIndex(idx);
    setEditValue(String(idx + 1));
  }, []);

  const handleEditBlur = useCallback(() => setEditingIndex(null), []);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const moveToPosition = useCallback(
    (fromIndex: number, toPosition: number) => {
      if (toPosition < 1 || toPosition > items.length) return;
      if (pinnedIds.has(items[fromIndex].id)) return;

      const movedItem = items[fromIndex];
      const newItems = [...items];
      const [item] = newItems.splice(fromIndex, 1);
      newItems.splice(toPosition - 1, 0, item);
      onReorder(newItems);
      onItemMoved?.(movedItem.id);
      setEditingIndex(null);
    },
    [items, onReorder, pinnedIds, onItemMoved]
  );

  const handleRankKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, originalIndex: number) => {
      if (e.key === "Enter") {
        const pos = parseInt(editValue, 10);
        if (!isNaN(pos)) moveToPosition(originalIndex, pos);
        setEditingIndex(null);
      } else if (e.key === "Escape") {
        setEditingIndex(null);
      }
    },
    [editValue, moveToPosition]
  );

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
    <div className="flex flex-col h-full">
      {/* Header */}
      {(title || description) && (
        <div className="mb-3">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background px-8 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      </div>

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
          {/* Sticky top N */}
          {!isSearching && stickyItems.length > 0 && (
            <div className="shrink-0 space-y-1 pb-1 mb-1 border-b border-dashed border-muted-foreground/20">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1">
                Top {stickyCount}
              </p>
              {stickyItems.map((item, i) => (
                <DraggableRow
                  key={item.id}
                  item={item}
                  index={i}
                  isPinned={pinnedIds.has(item.id)}
                  isSticky={true}
                  editingIndex={editingIndex}
                  editValue={editValue}
                  onEditStart={handleEditStart}
                  onEditChange={setEditValue}
                  onEditKeyDown={handleRankKeyDown}
                  onEditBlur={handleEditBlur}
                  onTogglePin={togglePin}
                />
              ))}
            </div>
          )}

          {/* Scrollable rest — virtualized */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1">
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
                      isPinned={pinnedIds.has(item.id)}
                      isSticky={false}
                      editingIndex={editingIndex}
                      editValue={editValue}
                      onEditStart={handleEditStart}
                      onEditChange={setEditValue}
                      onEditKeyDown={handleRankKeyDown}
                      onEditBlur={handleEditBlur}
                      onTogglePin={togglePin}
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
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
        <span>
          {items.length} items
          {isSearching && ` · ${filteredItems.length} shown`}
          {pinnedIds.size > 0 && ` · ${pinnedIds.size} locked`}
        </span>
        <span className="text-[10px]">Drag to reorder · click rank # to jump</span>
      </div>
    </div>
  );
}
