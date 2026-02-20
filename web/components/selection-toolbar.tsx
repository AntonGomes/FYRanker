"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRegionStyle } from "@/lib/region-colors";
import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore } from "@/lib/scoring";
import {
  Columns2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";

interface SelectionToolbarProps {
  count: number;
  selectedJobs: ScoredJob[];
  onClear: () => void;
  onCompare: () => void;
  onMoveTo: () => void;
  onBoostAll: () => void;
  onBuryAll: () => void;
}

export function SelectionToolbar({
  count,
  selectedJobs,
  onClear,
  onCompare,
  onMoveTo,
  onBoostAll,
  onBuryAll,
}: SelectionToolbarProps) {
  return (
    <div className="w-56 shrink-0 border-l bg-card flex flex-col overflow-hidden">
      <div className="px-3 py-3 border-b flex items-center justify-between">
        <span className="text-sm font-semibold">{count} selected</span>
        <button
          onClick={onClear}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1 p-3 border-b">
        {count >= 2 && (
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-2 text-xs"
            onClick={onCompare}
          >
            <Columns2 className="h-3.5 w-3.5" />
            Compare
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2 text-xs"
          onClick={onMoveTo}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Move To...
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2 text-xs text-emerald-400 hover:bg-emerald-950/30"
          onClick={onBoostAll}
        >
          <ChevronUp className="h-3.5 w-3.5" />
          Boost All
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2 text-xs text-red-400 hover:bg-red-950/30"
          onClick={onBuryAll}
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Bury All
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {selectedJobs.map((sj) => {
          const regionStyle = getRegionStyle(sj.job.region);
          const score = effectiveScore(sj);
          return (
            <div
              key={sj.job.programmeTitle}
              className="rounded-md border bg-background p-2 space-y-1"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-1 py-0 text-[8px] font-semibold border shrink-0",
                    regionStyle.bg,
                    regionStyle.text,
                    regionStyle.border
                  )}
                >
                  {sj.job.region}
                </span>
                <span className="text-[10px] font-mono font-medium text-foreground truncate flex-1 min-w-0">
                  {sj.job.programmeTitle}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Score: {score.toFixed(3)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
