"use client";

import { useState, useRef, useMemo, useCallback, memo } from "react";
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
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import {
  GripVertical,
  Plus,
  X,
  Lock,
  Unlock,
  Search,
  ChevronsRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { REGION_COLORS } from "@/components/job-detail-panel";

export interface PickRankItem {
  id: string;
  label: string;
  badge?: string;
}

interface PickRankPanelProps {
  /** All items (available derived as allItems minus ranked) */
  allItems: PickRankItem[];
  /** Currently ranked items in order */
  rankedItems: PickRankItem[];
  /** Called when ranked list changes */
  onRankedChange: (items: PickRankItem[]) => void;
  /** Enable lock toggle per item (specialties) */
  allowLock?: boolean;
  /** Currently locked IDs */
  lockedIds?: Set<string>;
  /** Called when lock state changes */
  onLockedChange?: (ids: Set<string>) => void;
  /** Slot rendered above the available pool (e.g. proximity button) */
  availableHeader?: React.ReactNode;
  /** Empty state message for ranked panel */
  emptyMessage?: string;
}

/* ── Styling helpers ── */

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

/* ── Available item row ── */
const AvailableRow = memo(function AvailableRow({
  item,
  checked,
  onToggleCheck,
  onAdd,
}: {
  item: PickRankItem;
  checked: boolean;
  onToggleCheck: (id: string) => void;
  onAdd: (item: PickRankItem) => void;
}) {
  const regionStyle = item.badge ? REGION_COLORS[item.badge] : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-2.5 py-2 hover:bg-accent/40 transition-colors cursor-pointer group"
      onClick={() => onAdd(item)}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onToggleCheck(item.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0 cursor-pointer"
      />
      <span className="flex-1 text-sm truncate min-w-0">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium",
            regionStyle
              ? `${regionStyle.text} border ${regionStyle.border}`
              : "bg-muted text-muted-foreground"
          )}
        >
          {item.badge}
        </span>
      )}
      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
});

/* ── Ranked draggable row ── */
const RankedRow = memo(function RankedRow({
  item,
  index,
  isLocked,
  allowLock,
  onToggleLock,
  onRemove,
}: {
  item: PickRankItem;
  index: number;
  isLocked: boolean;
  allowLock: boolean;
  onToggleLock: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const regionStyle = item.badge ? REGION_COLORS[item.badge] : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors touch-manipulation",
        isLocked
          ? "ring-2 ring-amber-400/30 bg-amber-400/5 border-amber-400/20 cursor-default"
          : "bg-card hover:bg-accent/50 cursor-grab",
        !isLocked && rankRowClass(index),
        isDragging && "opacity-40 shadow-lg z-50"
      )}
      {...attributes}
      {...(isLocked ? {} : listeners)}
    >
      {isLocked ? (
        <Lock className="h-4 w-4 shrink-0 text-amber-400/70" />
      ) : (
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}

      <span
        className={cn(
          "w-7 shrink-0 text-center text-xs font-mono",
          rankClass(index)
        )}
      >
        {index + 1}
      </span>

      <span className="flex-1 text-sm truncate min-w-0">{item.label}</span>

      {item.badge && (
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium",
            regionStyle
              ? `${regionStyle.text} border ${regionStyle.border}`
              : "bg-muted text-muted-foreground"
          )}
        >
          {item.badge}
        </span>
      )}

      {allowLock && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(item.id);
          }}
          className={cn(
            "shrink-0 p-0.5 rounded transition-colors",
            isLocked
              ? "text-amber-400 hover:text-amber-300"
              : "text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100"
          )}
          title={isLocked ? "Unlock" : "Lock (skip in duel)"}
        >
          {isLocked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Unlock className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        className="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});

/* ── Drag overlay row ── */
const DragOverlayRow = memo(function DragOverlayRow({
  item,
  index,
}: {
  item: PickRankItem;
  index: number;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-2 py-2.5 shadow-xl ring-2 ring-primary/20 scale-[1.03]">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span
        className={cn(
          "w-7 shrink-0 text-center text-xs font-mono",
          rankClass(index)
        )}
      >
        {index + 1}
      </span>
      <span className="flex-1 text-sm truncate min-w-0">{item.label}</span>
    </div>
  );
});

/* ── Main component ── */
export function PickRankPanel({
  allItems,
  rankedItems,
  onRankedChange,
  allowLock = false,
  lockedIds,
  onLockedChange,
  availableHeader,
  emptyMessage = "Click items on the left to start ranking",
}: PickRankPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const rankedScrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Derive available items
  const rankedIdSet = useMemo(
    () => new Set(rankedItems.map((i) => i.id)),
    [rankedItems]
  );

  const availableItems = useMemo(
    () => allItems.filter((i) => !rankedIdSet.has(i.id)),
    [allItems, rankedIdSet]
  );

  const filteredAvailable = useMemo(() => {
    if (!searchQuery) return availableItems;
    const q = searchQuery.toLowerCase();
    return availableItems.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.badge && i.badge.toLowerCase().includes(q))
    );
  }, [availableItems, searchQuery]);

  // Clean up checked IDs that are no longer available
  const validCheckedIds = useMemo(
    () => new Set([...checkedIds].filter((id) => !rankedIdSet.has(id))),
    [checkedIds, rankedIdSet]
  );

  // Index map for ranked items
  const rankedIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rankedItems.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [rankedItems]);

  // Virtualizer for ranked list
  const rankedVirtualizer = useVirtualizer({
    count: rankedItems.length,
    getScrollElement: () => rankedScrollRef.current,
    estimateSize: () => 46,
    overscan: 10,
  });

  // Actions
  const addItem = useCallback(
    (item: PickRankItem) => {
      onRankedChange([...rankedItems, item]);
      setCheckedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    },
    [rankedItems, onRankedChange]
  );

  const addChecked = useCallback(() => {
    const toAdd = availableItems.filter((i) => validCheckedIds.has(i.id));
    if (toAdd.length === 0) return;
    onRankedChange([...rankedItems, ...toAdd]);
    setCheckedIds(new Set());
  }, [availableItems, validCheckedIds, rankedItems, onRankedChange]);

  const addRemaining = useCallback(() => {
    onRankedChange([...rankedItems, ...availableItems]);
    setCheckedIds(new Set());
  }, [availableItems, rankedItems, onRankedChange]);

  const removeItem = useCallback(
    (id: string) => {
      onRankedChange(rankedItems.filter((i) => i.id !== id));
      // Also unlock if locked
      if (lockedIds?.has(id) && onLockedChange) {
        const next = new Set(lockedIds);
        next.delete(id);
        onLockedChange(next);
      }
    },
    [rankedItems, onRankedChange, lockedIds, onLockedChange]
  );

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleLock = useCallback(
    (id: string) => {
      if (!onLockedChange || !lockedIds) return;
      const next = new Set(lockedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onLockedChange(next);
    },
    [lockedIds, onLockedChange]
  );

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = rankedIndexById.get(active.id as string) ?? -1;
      const newIndex = rankedIndexById.get(over.id as string) ?? -1;
      if (oldIndex !== -1 && newIndex !== -1) {
        onRankedChange(arrayMove(rankedItems, oldIndex, newIndex));
      }
    }
  }

  const activeItem = activeId
    ? rankedItems.find((i) => i.id === activeId)
    : null;
  const activeIndex = activeId ? (rankedIndexById.get(activeId) ?? -1) : -1;

  const locked = lockedIds ?? new Set<string>();

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-1 min-h-0">
      {/* ── Available Pool ── */}
      <div className="flex flex-col sm:flex-1 min-h-0 sm:min-h-0 rounded-xl border border-border/50 bg-muted/30 p-3 gap-2 max-h-[40vh] sm:max-h-none">
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Available
          </h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {availableItems.length} left
          </span>
        </div>

        {availableHeader}

        {/* Search */}
        {allItems.length > 6 && (
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring/50 placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Available items list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
          <AnimatePresence mode="popLayout">
            {filteredAvailable.map((item) => (
              <AvailableRow
                key={item.id}
                item={item}
                checked={validCheckedIds.has(item.id)}
                onToggleCheck={toggleCheck}
                onAdd={addItem}
              />
            ))}
          </AnimatePresence>
          {filteredAvailable.length === 0 && availableItems.length > 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No matches
            </p>
          )}
          {availableItems.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              All items ranked
            </p>
          )}
        </div>

        {/* Bulk actions */}
        {availableItems.length > 0 && (
          <div className="flex gap-2 shrink-0">
            {validCheckedIds.size > 0 && (
              <button
                onClick={addChecked}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-accent/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add selected ({validCheckedIds.size})
              </button>
            )}
            <button
              onClick={addRemaining}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <ChevronsRight className="h-3 w-3" />
              Add remaining ({availableItems.length})
            </button>
          </div>
        )}
      </div>

      {/* ── Ranked List ── */}
      <div className="flex flex-col sm:flex-1 min-h-0 rounded-xl border-2 border-primary/20 bg-card p-3 gap-2 flex-1">
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Your Ranking
          </h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {rankedItems.length} ranked
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 20 }}
        >
          <SortableContext
            items={rankedItems.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={rankedScrollRef}
              className="flex-1 overflow-y-auto min-h-0 px-0.5"
            >
              {rankedItems.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-[80px] text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : rankedItems.length > 30 ? (
                /* Virtualized for large lists */
                <div
                  style={{
                    height: `${rankedVirtualizer.getTotalSize()}px`,
                    position: "relative",
                  }}
                >
                  {rankedVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = rankedItems[virtualRow.index];
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
                        <RankedRow
                          item={item}
                          index={virtualRow.index}
                          isLocked={locked.has(item.id)}
                          allowLock={allowLock}
                          onToggleLock={toggleLock}
                          onRemove={removeItem}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Non-virtualized for small lists */
                <div className="space-y-1">
                  {rankedItems.map((item, index) => (
                    <RankedRow
                      key={item.id}
                      item={item}
                      index={index}
                      isLocked={locked.has(item.id)}
                      allowLock={allowLock}
                      onToggleLock={toggleLock}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              )}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? (
              <DragOverlayRow item={activeItem} index={activeIndex} />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Footer */}
        <div className="flex items-center text-xs text-muted-foreground border-t pt-2 shrink-0">
          <span>
            {rankedItems.length} ranked
            {allowLock && locked.size > 0 && ` · ${locked.size} locked`}
            <span className="sm:hidden"> · Hold to drag</span>
          </span>
        </div>
      </div>
    </div>
  );
}
