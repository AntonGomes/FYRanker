"use client";

import { memo } from "react";
import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore } from "@/lib/scoring";
import { getJobPlacements } from "@/lib/parse-xlsx";
import type { PlacementEntry } from "@/lib/parse-xlsx";
import { getRegionStyle } from "@/components/job-detail-panel";
import { cn } from "@/lib/utils";
import { PLACEMENTS_PER_FY, SCORE_DISPLAY_DECIMALS } from "@/lib/constants";
import type { RegionStyle } from "@/components/results-view/list-row-types";
import {
  PlacementCell,
  DesktopStaticScoreBadge,
} from "@/components/results-view/list-row-desktop";


function buildAllPlacements(
  fy1: PlacementEntry[],
  fy2: PlacementEntry[]
): (PlacementEntry | null)[] {
  const result: (PlacementEntry | null)[] = [];
  for (let i = 0; i < PLACEMENTS_PER_FY; i++) result.push(fy1[i] ?? null);
  for (let i = 0; i < PLACEMENTS_PER_FY; i++) result.push(fy2[i] ?? null);
  return result;
}


function OverlayFYColumn({
  label,
  entries,
}: {
  label: string;
  entries: PlacementEntry[];
}): React.JSX.Element {
  return (
    <div>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      {[0, 1, 2].map((i) => {
        const entry = entries[i];
        if (entry) {
          return (
            <div key={entry.num} className="mt-1.5">
              <p className="text-[11px] font-semibold text-foreground leading-tight truncate">
                {entry.spec}
              </p>
              <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate">
                {entry.site}
              </p>
            </div>
          );
        }
        return (
          <div key={i} className="mt-1.5">
            <span className="text-[11px] text-muted-foreground">—</span>
          </div>
        );
      })}
    </div>
  );
}


interface ListDragOverlayRowProps {
  scored: ScoredJob;
  rank: number;
  isMobile?: boolean;
}


function MobileDragOverlayHeader({
  rank,
  regionStyle,
  region,
  title,
  score,
}: {
  rank: number;
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
        <span className="font-mono tabular-nums text-xs font-semibold text-foreground">
          {score.toFixed(SCORE_DISPLAY_DECIMALS)}
        </span>
      </div>
    </div>
  );
}


function MobileOverlayContent({
  scored,
  rank,
  regionStyle,
  score,
  fy1,
  fy2,
}: {
  scored: ScoredJob;
  rank: number;
  regionStyle: ReturnType<typeof getRegionStyle>;
  score: number;
  fy1: PlacementEntry[];
  fy2: PlacementEntry[];
}): React.JSX.Element {
  return (
    <div
      className="flex flex-col py-2 px-2.5 bg-card-drag ring-2 ring-primary/50 scale-[1.03] rounded-md transition-all duration-150"
      style={{
        boxShadow: `0 12px 32px ${regionStyle.color}40, 0 6px 16px rgba(0,0,0,0.15)`,
      }}
    >
      <MobileDragOverlayHeader
        rank={rank}
        regionStyle={regionStyle}
        region={scored.job.region}
        title={scored.job.programmeTitle}
        score={score}
      />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0 mt-1.5">
        <OverlayFYColumn label="FY1" entries={fy1} />
        <OverlayFYColumn label="FY2" entries={fy2} />
      </div>
    </div>
  );
}


function DesktopOverlayContent({
  scored,
  regionStyle,
  rank,
  score,
  allPlacements,
}: {
  scored: ScoredJob;
  regionStyle: ReturnType<typeof getRegionStyle>;
  rank: number;
  score: number;
  allPlacements: (PlacementEntry | null)[];
}): React.JSX.Element {
  return (
    <div
      className="grid items-center gap-x-0.5 h-[56px] bg-card-drag ring-2 ring-primary/50 scale-[1.03] rounded-md transition-all duration-150"
      style={{
        gridTemplateColumns:
          "40px auto minmax(100px,auto) repeat(6, minmax(90px, 1fr)) 90px 140px",
        boxShadow: `0 12px 32px ${regionStyle.color}40, 0 6px 16px rgba(0,0,0,0.15)`,
      }}
    >
      <span className="text-sm font-bold font-mono text-foreground text-right pr-2">
        {rank}
      </span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold border truncate text-center",
          regionStyle.bg,
          regionStyle.text,
          regionStyle.border
        )}
      >
        {scored.job.region}
      </span>
      <span className="text-xs font-mono font-semibold text-foreground truncate pr-16">
        {scored.job.programmeTitle}
      </span>
      {allPlacements.map((entry, i) => (
        <div key={i} className="min-w-0 pr-0.5">
          <PlacementCell entry={entry} />
        </div>
      ))}
      <DesktopStaticScoreBadge score={score} />
      <span />
    </div>
  );
}


const ListDragOverlayRow = memo(function ListDragOverlayRow({
  scored,
  rank,
  isMobile,
}: ListDragOverlayRowProps): React.JSX.Element {
  const regionStyle = getRegionStyle(scored.job.region);
  const { fy1, fy2 } = getJobPlacements(scored.job);
  const score = effectiveScore(scored);
  const allPlacements = buildAllPlacements(fy1, fy2);

  if (isMobile) {
    return (
      <MobileOverlayContent
        scored={scored}
        rank={rank}
        regionStyle={regionStyle}
        score={score}
        fy1={fy1}
        fy2={fy2}
      />
    );
  }

  return (
    <DesktopOverlayContent
      scored={scored}
      regionStyle={regionStyle}
      rank={rank}
      score={score}
      allPlacements={allPlacements}
    />
  );
});

export { ListDragOverlayRow };
