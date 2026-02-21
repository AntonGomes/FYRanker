"use client";

import { useCallback, memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PlacementEntry } from "@/lib/parse-xlsx";
import { getJobPlacements } from "@/lib/parse-xlsx";
import { effectiveScore } from "@/lib/scoring";
import { getRegionStyle } from "@/components/job-detail-panel";
import { cn } from "@/lib/utils";
import { PLACEMENTS_PER_FY } from "@/lib/constants";
import type { ListRowProps } from "@/components/results-view/list-row-types";
import { MobileContent } from "@/components/results-view/list-row-mobile-layout";
import { DesktopContent } from "@/components/results-view/list-row-desktop-layout";
import { useSwipeBoostBury } from "@/components/results-view/use-swipe-boost-bury";
import { PlacementList } from "@/components/results-view/list-row-shared";
import { ListDragOverlayRow } from "@/components/results-view/list-drag-overlay-row";

function buildAllPlacements(
  fy1: PlacementEntry[],
  fy2: PlacementEntry[],
): (PlacementEntry | null)[] {
  const result: (PlacementEntry | null)[] = [];
  for (let i = 0; i < PLACEMENTS_PER_FY; i++) result.push(fy1[i] ?? null);
  for (let i = 0; i < PLACEMENTS_PER_FY; i++) result.push(fy2[i] ?? null);
  return result;
}

function getWashClass(dir: "up" | "down" | null): string {
  if (dir === "up") return "animate-wash-up";
  if (dir === "down") return "animate-wash-down";
  return "";
}

interface RowClassOpts {
  isLocked: boolean;
  isSelected: boolean;
  isDetailOpen: boolean;
  isDragging: boolean;
}

function baseRowClasses(o: RowClassOpts): string {
  return cn(
    o.isLocked ? "cursor-default" : "cursor-grab",
    o.isSelected
      ? "bg-card-selected ring-1 ring-primary/60"
      : o.isDetailOpen
        ? "ring-1 ring-primary/40 bg-primary/5"
        : "hover:bg-card-hover",
    o.isDragging && "opacity-30 scale-[0.97] z-50",
    o.isLocked && "bg-amber-950/20",
  );
}

const DESKTOP_GRID =
  "40px auto minmax(100px,auto) repeat(6, minmax(90px, 1fr)) 90px 140px";

const ListRow = memo(function ListRow({
  scored, rank, isSelected, isPinned, isLocked, isMobile,
  onSelectDetail, onToggleSelect, onTogglePin, onToggleLock,
  onBoost, onBury, onMoveToOpen,
  flashDirection, glowKey, rankDelta, isDetailOpen,
}: ListRowProps) {
  const jobId = scored.job.programmeTitle;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: jobId, disabled: isLocked });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const regionStyle = getRegionStyle(scored.job.region);
  const { fy1, fy2 } = getJobPlacements(scored.job);
  const score = effectiveScore(scored);
  const washClass = getWashClass(flashDirection);
  const allPlacements = buildAllPlacements(fy1, fy2);
  const job = scored.job;
  const handleBoost = useCallback(() => onBoost(jobId), [onBoost, jobId]);
  const handleBury = useCallback(() => onBury(jobId), [onBury, jobId]);
  const swipe = useSwipeBoostBury({ onBoost: handleBoost, onBury: handleBury, isDragging, isLocked });
  const handleClick = useCallback(() => onSelectDetail(job), [onSelectDetail, job]);
  const clsOpts: RowClassOpts = { isLocked, isSelected, isDetailOpen, isDragging };

  if (isMobile) {
    const cls = cn("relative overflow-hidden rounded-xl mx-3 my-1 transition-all duration-150", baseRowClasses(clsOpts));
    const shadow = isSelected ? undefined : `0 2px 8px ${regionStyle.color}20, 0 1px 3px rgba(0,0,0,0.06)`;
    return (
      <div key={glowKey} ref={setNodeRef} data-job-id={jobId}
        style={{ ...style, boxShadow: shadow }} {...attributes} {...listeners}
        className={cls} onClick={handleClick} role="row">
        <MobileContent scored={scored} rank={rank} flashDirection={flashDirection}
          rankDelta={rankDelta} regionStyle={regionStyle} score={score} fy1={fy1} fy2={fy2}
          washClass={washClass} swipeX={swipe.swipeX} pendingAction={swipe.pendingAction}
          onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} />
      </div>
    );
  }

  const cls = cn("relative grid items-center gap-x-0.5 h-[56px] border-b border-border transition-all duration-150", baseRowClasses(clsOpts), washClass);
  const shadow = isSelected ? undefined : `inset 3px 0 0 ${regionStyle.color}40`;
  return (
    <div key={glowKey} ref={setNodeRef} data-job-id={jobId}
      style={{ ...style, gridTemplateColumns: DESKTOP_GRID, boxShadow: shadow }}
      {...attributes} {...listeners} className={cls} onClick={handleClick} role="row">
      <DesktopContent scored={scored} rank={rank} isPinned={isPinned} isLocked={isLocked}
        isSelected={isSelected} flashDirection={flashDirection} rankDelta={rankDelta}
        regionStyle={regionStyle} score={score} allPlacements={allPlacements}
        onBoost={onBoost} onBury={onBury} onMoveToOpen={onMoveToOpen}
        onTogglePin={onTogglePin} onToggleLock={onToggleLock} onToggleSelect={onToggleSelect} />
    </div>
  );
});

export { ListRow, ListDragOverlayRow, PlacementList };
