import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore } from "@/lib/scoring";

export function createDragStartHandler(
  setActiveId: (id: string | null) => void
): (event: DragStartEvent) => void {
  return function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  };
}

interface DragEndOpts {
  event: DragEndEvent;
  lockedJobIds: Set<string>;
  setActiveId: (id: string | null) => void;
  pushAndSetRanked: (updater: (prev: ScoredJob[]) => ScoredJob[]) => void;
}

function reorderWithScoreAdj(opts: {
  prev: ScoredJob[];
  activeId: string;
  overId: string;
}): ScoredJob[] {
  const { prev, activeId, overId } = opts;
  const oldIndex = prev.findIndex((s) => s.job.programmeTitle === activeId);
  const newIndex = prev.findIndex((s) => s.job.programmeTitle === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)
    return prev;
  const reordered = arrayMove(prev, oldIndex, newIndex);

  const moved = reordered[newIndex];
  const targetScore =
    newIndex === 0
      ? effectiveScore(reordered[1])
      : effectiveScore(reordered[newIndex - 1]);
  reordered[newIndex] = {
    ...moved,
    scoreAdjustment: targetScore - moved.score,
  };
  return reordered;
}

export function handleDragEnd(opts: DragEndOpts): void {
  const { event, lockedJobIds, setActiveId, pushAndSetRanked } = opts;
  const { active, over } = event;
  setActiveId(null);

  if (!over || active.id === over.id) return;

  const activeId = active.id as string;
  const overId = over.id as string;
  if (lockedJobIds.has(activeId) || lockedJobIds.has(overId)) return;

  pushAndSetRanked((prev) =>
    reorderWithScoreAdj({ prev, activeId, overId })
  );
}

export function createDragCancelHandler(
  setActiveId: (id: string | null) => void
): () => void {
  return function handleDragCancel() {
    setActiveId(null);
  };
}
