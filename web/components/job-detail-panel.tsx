"use client";

import type { Job } from "@/lib/parse-xlsx";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const REGION_COLORS: Record<string, { bg: string; border: string; text: string; color: string }> = {
  West: {
    bg: "bg-region-west-bg",
    border: "border-region-west-border",
    text: "text-region-west-fg",
    color: "var(--region-west)",
  },
  East: {
    bg: "bg-region-east-bg",
    border: "border-region-east-border",
    text: "text-region-east-fg",
    color: "var(--region-east)",
  },
  North: {
    bg: "bg-region-north-bg",
    border: "border-region-north-border",
    text: "text-region-north-fg",
    color: "var(--region-north)",
  },
  "South and SE": {
    bg: "bg-region-south-bg",
    border: "border-region-south-border",
    text: "text-region-south-fg",
    color: "var(--region-south)",
  },
};

function getRegionStyle(region: string) {
  return REGION_COLORS[region] ?? {
    bg: "bg-muted",
    border: "border-border",
    text: "text-muted-foreground",
    color: "var(--border)",
  };
}

export { getRegionStyle, REGION_COLORS };

interface JobDetailPanelProps {
  job: Job;
  onClose: () => void;
}

export function JobDetailPanel({ job, onClose }: JobDetailPanelProps) {
  const style = getRegionStyle(job.region);

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* Header */}
      <div className={cn("px-5 py-4 border-b", style.bg)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-tight truncate">
              {job.programme_title}
            </h2>
            <span
              className={cn(
                "inline-block mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                style.bg,
                style.border,
                style.text,
                "border"
              )}
            >
              {job.region}
            </span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Placements */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Placements
        </h3>
        <div className="space-y-3">
          {([1, 2, 3, 4, 5, 6] as const).map((i) => {
            const key = `placement_${i}` as const;
            const placement = job[key];
            if (
              !placement.site ||
              placement.site === "None" ||
              placement.site.trim() === ""
            )
              return null;

            return (
              <div
                key={i}
                className="rounded-lg border bg-muted/30 p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {i}
                  </span>
                  <span className="font-medium text-sm">{placement.site}</span>
                </div>
                <div className="ml-7 space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Specialty:
                    </span>{" "}
                    {placement.speciality}
                  </p>
                  {placement.description &&
                    placement.description !== "None" && (
                      <p className="text-xs text-muted-foreground">
                        {placement.description}
                      </p>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
