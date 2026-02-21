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



export type PlacementEntry = { site: string; spec: string; description?: string; num: number };

export function isValidPlacement(p: Placement) {
  return p.site && p.site !== "None" && p.site.trim() !== "";
}

const FY1_PLACEMENT_COUNT = 3;

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
      if (i < FY1_PLACEMENT_COUNT) fy1.push(entry);
      else fy2.push(entry);
    }
  }
  return { fy1, fy2 };
}
