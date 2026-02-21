"use client";

import type { PlacementEntry } from "@/lib/parse-xlsx";
import { cn } from "@/lib/utils";
import { SCORE_DISPLAY_DECIMALS } from "@/lib/constants";
import { ArrowUpDown, Pin, Lock } from "lucide-react";
import { AnimatedScore } from "@/components/results-view/animated-score";
import { ArrowUp, ArrowDown } from "@/components/results-view/list-row-shared";

interface PlacementCellProps {
  entry: PlacementEntry | null;
}

function PlacementCell({
  entry,
}: PlacementCellProps): React.JSX.Element {
  if (!entry) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-foreground leading-tight truncate">
        {entry.spec}
      </p>
      <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate">
        {entry.site}
      </p>
    </div>
  );
}

interface DesktopScoreBadgeProps {
  score: number;
  flashDirection: "up" | "down" | null;
}

function DesktopScoreBadge({
  score,
  flashDirection,
}: DesktopScoreBadgeProps): React.JSX.Element {
  return (
    <div className="flex justify-center">
      <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Score
        </span>
        <AnimatedScore
          value={score}
          flashDirection={flashDirection}
        />
      </div>
    </div>
  );
}

function DesktopStaticScoreBadge({
  score,
}: {
  score: number;
}): React.JSX.Element {
  return (
    <div className="flex justify-center">
      <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Score
        </span>
        <span className="font-mono tabular-nums text-xs font-semibold text-foreground">
          {score.toFixed(SCORE_DISPLAY_DECIMALS)}
        </span>
      </div>
    </div>
  );
}

interface BoostBuryButtonsProps {
  jobId: string;
  isLocked: boolean;
  onBoost: (jobId: string) => void;
  onBury: (jobId: string) => void;
}

function BoostBuryButtons({
  jobId,
  isLocked,
  onBoost,
  onBury,
}: BoostBuryButtonsProps): React.JSX.Element {
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBoost(jobId);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "p-0.5 rounded text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 active:scale-90 transition-all",
          isLocked && "pointer-events-none opacity-30"
        )}
        title="Boost"
      >
        <ArrowUp />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBury(jobId);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "p-0.5 rounded text-red-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all",
          isLocked && "pointer-events-none opacity-30"
        )}
        title="Bury"
      >
        <ArrowDown />
      </button>
    </>
  );
}

function stopProp(e: React.MouseEvent | React.PointerEvent): void {
  e.stopPropagation();
}

function MoveButton({ jobId, rank, isLocked, onMoveToOpen }: {
  jobId: string; rank: number; isLocked: boolean;
  onMoveToOpen: (id: string, rank: number) => void;
}): React.JSX.Element {
  return (
    <button
      onClick={(e) => { stopProp(e); onMoveToOpen(jobId, rank); }}
      onPointerDown={stopProp}
      className={cn(
        "p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
        isLocked && "pointer-events-none opacity-30"
      )}
      title="Move to..."
    >
      <ArrowUpDown className="h-4 w-4" />
    </button>
  );
}

function PinButton({ jobId, isPinned, onTogglePin }: {
  jobId: string; isPinned: boolean; onTogglePin: (id: string) => void;
}): React.JSX.Element {
  return (
    <button
      onClick={(e) => { stopProp(e); onTogglePin(jobId); }}
      onPointerDown={stopProp}
      className={cn(
        "p-0.5 rounded transition-colors",
        isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
      title={isPinned ? "Unpin" : "Pin"}
    >
      <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-primary")} />
    </button>
  );
}

function LockButton({ jobId, isLocked, onToggleLock }: {
  jobId: string; isLocked: boolean; onToggleLock: (id: string) => void;
}): React.JSX.Element {
  return (
    <button
      onClick={(e) => { stopProp(e); onToggleLock(jobId); }}
      onPointerDown={stopProp}
      className={cn(
        "p-0.5 rounded transition-colors",
        isLocked ? "text-amber-500" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
      title={isLocked ? "Unlock" : "Lock"}
    >
      <Lock className={cn("h-3.5 w-3.5", isLocked && "fill-amber-500/20")} />
    </button>
  );
}

interface RowMetaButtonsProps {
  jobId: string;
  rank: number;
  isLocked: boolean;
  isPinned: boolean;
  isSelected: boolean;
  onMoveToOpen: (jobId: string, rank: number) => void;
  onTogglePin: (jobId: string) => void;
  onToggleLock: (jobId: string) => void;
  onToggleSelect: (jobId: string) => void;
}

function RowMetaButtons(p: RowMetaButtonsProps): React.JSX.Element {
  return (
    <>
      <MoveButton jobId={p.jobId} rank={p.rank} isLocked={p.isLocked} onMoveToOpen={p.onMoveToOpen} />
      <PinButton jobId={p.jobId} isPinned={p.isPinned} onTogglePin={p.onTogglePin} />
      <LockButton jobId={p.jobId} isLocked={p.isLocked} onToggleLock={p.onToggleLock} />
      <SelectCircle jobId={p.jobId} isSelected={p.isSelected} onToggleSelect={p.onToggleSelect} />
    </>
  );
}

function SelectCircle({
  jobId,
  isSelected,
  onToggleSelect,
}: {
  jobId: string;
  isSelected: boolean;
  onToggleSelect: (jobId: string) => void;
}): React.JSX.Element {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggleSelect(jobId);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="p-0.5 flex items-center justify-center"
      title={isSelected ? "Deselect" : "Select"}
    >
      <div
        className={cn(
          "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
          isSelected
            ? "bg-primary border-primary"
            : "border-muted-foreground hover:border-primary"
        )}
      >
        {isSelected && (
          <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        )}
      </div>
    </button>
  );
}

export {
  PlacementCell,
  DesktopScoreBadge,
  DesktopStaticScoreBadge,
  BoostBuryButtons,
  RowMetaButtons,
};
