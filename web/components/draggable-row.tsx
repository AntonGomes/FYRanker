"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Lock, Unlock } from "lucide-react";
import { REGION_COLORS } from "@/lib/region-colors";
import type { RankableItem } from "@/components/rankable-list";

function RowBadge({ badge }: { badge: string }) {
  const regionStyle = REGION_COLORS[badge];
  return (
    <span className={cn(
      "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium",
      regionStyle
        ? `${regionStyle.text} border ${regionStyle.border}`
        : "bg-muted text-muted-foreground"
    )}>
      {badge}
    </span>
  );
}

function PinToggleButton({ isPinned, onTogglePin }: {
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  return (
    <button
      onClick={onTogglePin}
      className={cn(
        "p-0.5 transition-colors opacity-0 group-hover:opacity-100",
        isPinned
          ? "text-primary opacity-100"
          : "text-muted-foreground hover:text-foreground"
      )}
      title={isPinned ? "Unlock position" : "Lock position"}
    >
      {isPinned ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
    </button>
  );
}

export const DraggableRow = memo(function DraggableRow({
  item,
  index,
  isPinned,
  onTogglePin,
}: {
  item: RankableItem;
  index: number;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors touch-manipulation cursor-grab",
        isPinned ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-accent/50",
        isDragging && "opacity-40 shadow-lg z-50"
      )}
    >
      <span className="w-9 shrink-0 text-center text-xs font-mono text-muted-foreground">
        {index + 1}
      </span>
      <span className="flex-1 text-sm truncate min-w-0">{item.label}</span>
      {item.badge && <RowBadge badge={item.badge} />}
      <PinToggleButton isPinned={isPinned} onTogglePin={() => onTogglePin(item.id)} />
    </div>
  );
});

export const DragOverlayRow = memo(function DragOverlayRow({ item, index }: { item: RankableItem; index: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-2 py-2.5 shadow-xl ring-2 ring-primary/20 scale-[1.03]">
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
