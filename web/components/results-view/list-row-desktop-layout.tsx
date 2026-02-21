"use client";

import { cn } from "@/lib/utils";
import { RankChangeBadge } from "@/components/results-view/list-row-shared";
import type { DesktopContentProps } from "@/components/results-view/list-row-types";
import {
  PlacementCell,
  DesktopScoreBadge,
  BoostBuryButtons,
  RowMetaButtons,
} from "@/components/results-view/list-row-desktop";


function DesktopCells(p: Pick<
  DesktopContentProps,
  "rank" | "rankDelta" | "flashDirection" | "regionStyle" | "scored" | "allPlacements" | "score"
>): React.JSX.Element {
  return (
    <>
      <div className="flex items-center justify-end gap-1 pr-2">
        <RankChangeBadge delta={p.rankDelta} direction={p.flashDirection} />
        <span className="text-sm font-bold font-mono text-foreground">
          {p.rank}
        </span>
      </div>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold border truncate text-center mr-1",
          p.regionStyle.bg,
          p.regionStyle.text,
          p.regionStyle.border
        )}
      >
        {p.scored.job.region}
      </span>
      <span className="text-xs font-mono font-semibold text-foreground truncate pr-16">
        {p.scored.job.programmeTitle}
      </span>
      {p.allPlacements.map((entry, i) => (
        <div key={i} className="min-w-0 pr-0.5">
          <PlacementCell entry={entry} />
        </div>
      ))}
      <DesktopScoreBadge score={p.score} flashDirection={p.flashDirection} />
    </>
  );
}

function DesktopActions(p: Pick<
  DesktopContentProps,
  "scored" | "rank" | "isLocked" | "isPinned" | "isSelected"
  | "onBoost" | "onBury" | "onMoveToOpen" | "onTogglePin" | "onToggleLock" | "onToggleSelect"
>): React.JSX.Element {
  const jobId = p.scored.job.programmeTitle;
  return (
    <div className="flex items-center justify-center gap-0.5">
      <BoostBuryButtons
        jobId={jobId}
        isLocked={p.isLocked}
        onBoost={p.onBoost}
        onBury={p.onBury}
      />
      <RowMetaButtons
        jobId={jobId}
        rank={p.rank}
        isLocked={p.isLocked}
        isPinned={p.isPinned}
        isSelected={p.isSelected}
        onMoveToOpen={p.onMoveToOpen}
        onTogglePin={p.onTogglePin}
        onToggleLock={p.onToggleLock}
        onToggleSelect={p.onToggleSelect}
      />
    </div>
  );
}

function DesktopContent(p: DesktopContentProps): React.JSX.Element {
  return (
    <>
      <DesktopCells
        rank={p.rank} rankDelta={p.rankDelta} flashDirection={p.flashDirection}
        regionStyle={p.regionStyle} scored={p.scored}
        allPlacements={p.allPlacements} score={p.score}
      />
      <DesktopActions
        scored={p.scored} rank={p.rank} isLocked={p.isLocked}
        isPinned={p.isPinned} isSelected={p.isSelected}
        onBoost={p.onBoost} onBury={p.onBury} onMoveToOpen={p.onMoveToOpen}
        onTogglePin={p.onTogglePin} onToggleLock={p.onToggleLock}
        onToggleSelect={p.onToggleSelect}
      />
    </>
  );
}

export { DesktopContent };
