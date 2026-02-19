import type { Job } from "./parse-xlsx";

export interface ExtractedData {
  regions: string[];
  hospitalsByRegion: Record<string, string[]>;
  specialties: string[];
}

export function extractUniqueValues(jobs: Job[]): ExtractedData {
  const regionSet = new Set<string>();
  const regions: string[] = [];
  const hospMap = new Map<string, Set<string>>();
  const specialtySet = new Set<string>();

  for (const job of jobs) {
    const region = job.region;
    if (region && !regionSet.has(region)) {
      regionSet.add(region);
      regions.push(region);
      hospMap.set(region, new Set());
    }

    for (const p of job.placements) {
      const site = p.site;
      if (site && site !== "None" && site.trim() !== "") {
        hospMap.get(region)?.add(site);
      }

      const spec = p.specialty;
      if (spec && spec !== "None" && spec.trim() !== "") {
        specialtySet.add(spec);
      }
    }
  }

  const hospitalsByRegion: Record<string, string[]> = {};
  for (const [region, sites] of hospMap) {
    hospitalsByRegion[region] = Array.from(sites).sort();
  }

  return {
    regions,
    hospitalsByRegion,
    specialties: Array.from(specialtySet).sort(),
  };
}
