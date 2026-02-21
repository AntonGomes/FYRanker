export interface Placement {
  site: string;
  specialty: string;
  description?: string;
}

export interface Job {
  programmeTitle: string;
  deanery: string;
  region: "West" | "East" | "North" | "South and SE";
  placements: Placement[];
}

/* ── Shared placement helpers ── */

export type PlacementEntry = { site: string; spec: string; description?: string; num: number };

export function isValidPlacement(p: Placement) {
  return p.site && p.site !== "None" && p.site.trim() !== "";
}

export function getJobPlacements(job: Job): {
  fy1: PlacementEntry[];
  fy2: PlacementEntry[];
} {
  const fy1: PlacementEntry[] = [];
  const fy2: PlacementEntry[] = [];
  for (let i = 0; i < job.placements.length; i++) {
    const p = job.placements[i];
    if (isValidPlacement(p)) {
      const entry: PlacementEntry = {
        site: p.site,
        spec: p.specialty,
        description: p.description && p.description !== "None" ? p.description : undefined,
        num: i + 1,
      };
      if (i < 3) fy1.push(entry);
      else fy2.push(entry);
    }
  }
  return { fy1, fy2 };
}
