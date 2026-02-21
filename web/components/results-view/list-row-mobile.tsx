"use client";

import { memo } from "react";
import type { PlacementEntry } from "@/lib/parse-xlsx";
import { cn } from "@/lib/utils";
import { PLACEMENTS_PER_FY } from "@/lib/constants";
import { AnimatedScore } from "@/components/results-view/animated-score";
import {
  RankChangeBadge,
  ArrowUp,
  ArrowDown,
} from "@/components/results-view/list-row-shared";
import {
  SWIPE_BOOST_THRESHOLD,
  SWIPE_BURY_THRESHOLD,
} from "@/components/results-view/use-swipe-boost-bury";
import type { RegionStyle } from "@/components/results-view/list-row-types";


function MobileSwipeOverlay({
  swipeX,
  pendingAction,
}: {
  swipeX: number;
  pendingAction: "boost" | "bury" | null;
}): React.JSX.Element | null {
  if (swipeX > 0 || pendingAction === "boost") {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-start pl-4 rounded-xl transition-colors duration-150",
          pendingAction === "boost"
            ? "bg-emerald-500"
            : "bg-emerald-500/20"
        )}
      >
        {swipeX > SWIPE_BOOST_THRESHOLD && (
          <BoostLabel active={pendingAction === "boost"} />
        )}
      </div>
    );
  }
  if (swipeX < 0 || pendingAction === "bury") {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-end pr-4 rounded-xl transition-colors duration-150",
          pendingAction === "bury" ? "bg-red-500" : "bg-red-500/20"
        )}
      >
        {swipeX < SWIPE_BURY_THRESHOLD && (
          <BuryLabel active={pendingAction === "bury"} />
        )}
      </div>
    );
  }
  return null;
}


function BoostLabel({ active }: { active: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <ArrowUp />
      <span
        className={cn(
          "text-sm font-bold transition-opacity",
          active
            ? "text-white opacity-100"
            : "text-emerald-400 opacity-70"
        )}
      >
        Boost
      </span>
    </div>
  );
}

function BuryLabel({ active }: { active: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "text-sm font-bold transition-opacity",
          active ? "text-white opacity-100" : "text-red-400 opacity-70"
        )}
      >
        Bury
      </span>
      <ArrowDown />
    </div>
  );
}


function MobilePlacementSlot({
  entry,
  slotNum,
}: {
  entry: PlacementEntry | undefined;
  slotNum: number;
}): React.JSX.Element {
  if (entry) {
    return (
      <>
        <p className="text-[11px] font-semibold text-foreground leading-tight truncate">
          <span className="inline-block w-3 text-[10px] font-bold text-muted-foreground tabular-nums">
            {slotNum}
          </span>
          {entry.spec || "No specialty listed"}
        </p>
        <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate pl-3">
          {entry.site || "No site listed"}
        </p>
      </>
    );
  }
  return (
    <p className="text-[11px] text-muted-foreground leading-tight">
      <span className="inline-block w-3 text-[10px] font-bold tabular-nums">
        {slotNum}
      </span>
      —
    </p>
  );
}


const MobilePlacementsGrid = memo(function MobilePlacementsGrid({
  fy1,
  fy2,
}: {
  fy1: PlacementEntry[];
  fy2: PlacementEntry[];
}): React.JSX.Element {
  const groups = [
    { label: "FY1", entries: fy1, offset: 0 },
    { label: "FY2", entries: fy2, offset: PLACEMENTS_PER_FY },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-x-3 mt-1.5">
      {groups.map(({ label, entries, offset }) => (
        <div key={label}>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </span>
          {[0, 1, 2].map((i) => (
            <div
              key={offset + i + 1}
              className={cn(
                "mt-0.5 pt-0.5",
                i > 0 && "border-t border-border/40"
              )}
            >
              <MobilePlacementSlot
                entry={entries[i]}
                slotNum={offset + i + 1}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});


function MobileHeaderRow({
  rank,
  rankDelta,
  flashDirection,
  regionStyle,
  region,
  title,
  score,
}: {
  rank: number;
  rankDelta: number | null;
  flashDirection: "up" | "down" | null;
  regionStyle: RegionStyle;
  region: string;
  title: string;
  score: number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-bold font-mono text-foreground shrink-0">
        {rank}
      </span>
      <RankChangeBadge delta={rankDelta} direction={flashDirection} />
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold border shrink-0",
          regionStyle.bg,
          regionStyle.text,
          regionStyle.border
        )}
      >
        {region}
      </span>
      <span className="flex-1 text-xs font-mono font-semibold text-foreground truncate min-w-0">
        {title}
      </span>
      <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1 shrink-0">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Score
        </span>
        <AnimatedScore value={score} flashDirection={flashDirection} />
      </div>
    </div>
  );
}


export {
  MobileSwipeOverlay,
  MobilePlacementsGrid,
  MobileHeaderRow,
};
