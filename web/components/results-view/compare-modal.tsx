"use client";

import type { Job } from "@/lib/parse-xlsx";
import { isValidPlacement } from "@/lib/parse-xlsx";
import { getRegionStyle } from "@/components/job-detail-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface CompareModalProps {
  jobs: Job[];
  onClose: () => void;
  onClear: () => void;
}

function getPlacementSummary(job: Job): {
  sites: string[];
  specs: string[];
} {
  const sites: string[] = [];
  const specs = new Set<string>();
  for (const p of job.placements) {
    if (isValidPlacement(p)) {
      if (!sites.includes(p.site)) sites.push(p.site);
    }
    if (p.specialty && p.specialty !== "None" && p.specialty.trim() !== "")
      specs.add(p.specialty);
  }
  return { sites, specs: Array.from(specs) };
}

function CompareJobCard(props: { job: Job }): React.ReactNode {
  const { job } = props;
  const style = getRegionStyle(job.region);
  const { sites, specs } = getPlacementSummary(job);

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        style.bg,
        style.border
      )}
    >
      <div>
        <h3 className="font-semibold text-sm leading-tight">
          {job.programmeTitle}
        </h3>
        <span
          className={cn(
            "inline-block mt-1 text-xs font-medium",
            style.text
          )}
        >
          {job.region}
        </span>
      </div>
      <TagSection label="Sites" items={sites} />
      <TagSection label="Specialties" items={specs} />
      <PlacementList job={job} />
    </div>
  );
}

function TagSection(props: {
  label: string;
  items: string[];
}): React.ReactNode {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">
        {props.label}
      </p>
      <div className="flex flex-wrap gap-1">
        {props.items.map((s) => (
          <span
            key={s}
            className="rounded-md bg-background/60 border px-1.5 py-0.5 text-[11px]"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlacementList(props: { job: Job }): React.ReactNode {
  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-muted-foreground">
        All placements
      </p>
      {props.job.placements.map((p, i) => {
        if (!p.site || p.site === "None" || p.site.trim() === "")
          return null;
        return (
          <div
            key={i}
            className="text-xs p-2 rounded-md bg-background/50 border"
          >
            <span className="font-medium">{p.site}</span>
            <span className="text-muted-foreground">
              {" "}
              — {p.specialty}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CompareModal(props: CompareModalProps): React.ReactNode {
  const { jobs, onClose, onClear } = props;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-card border rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="font-semibold text-sm">
            Comparing {jobs.length} programmes
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${jobs.length}, 1fr)`,
            }}
          >
            {jobs.map((job) => (
              <CompareJobCard key={job.programmeTitle} job={job} />
            ))}
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end">
          <Button size="sm" variant="outline" onClick={onClear}>
            Clear comparison
          </Button>
        </div>
      </div>
    </div>
  );
}
