import type { Job } from "./parse-xlsx";
import type { SortableItem } from "@/components/sortable-list";

export interface ScoredJob {
  job: Job;
  score: number;
  regionScore: number;
  hospitalScore: number;
  specialtyScore: number;
}

function normalize(rank: number, total: number): number {
  if (total <= 1) return 1;
  return (total - rank) / (total - 1);
}

function buildRankMap(items: SortableItem[]): Map<string, number> {
  const map = new Map<string, number>();
  items.forEach((item, i) => map.set(item.label, i + 1));
  return map;
}

export function scoreJobs(
  jobs: Job[],
  rankedRegions: SortableItem[],
  globalHospitals: SortableItem[],
  rankedSpecialties: SortableItem[],
  weights: { region: number; hospital: number; specialty: number }
): ScoredJob[] {
  const regionRanks = buildRankMap(rankedRegions);
  const hospitalRanks = buildRankMap(globalHospitals);
  const specialtyRanks = buildRankMap(rankedSpecialties);

  const regionTotal = rankedRegions.length;
  const hospitalTotal = globalHospitals.length;
  const specialtyTotal = rankedSpecialties.length;

  return jobs
    .map((job) => {
      const regionRank = regionRanks.get(job.region) ?? regionTotal;
      const regionScore = normalize(regionRank, regionTotal);

      let hospSum = 0;
      let hospCount = 0;
      let specSum = 0;
      let specCount = 0;

      for (let i = 1; i <= 6; i++) {
        const key = `placement_${i}` as `placement_${1 | 2 | 3 | 4 | 5 | 6}`;
        const placement = job[key];

        const site = placement.site;
        if (site && site !== "None" && site.trim() !== "") {
          const rank = hospitalRanks.get(site) ?? hospitalTotal;
          hospSum += normalize(rank, hospitalTotal);
          hospCount++;
        }

        const spec = placement.speciality;
        if (spec && spec !== "None" && spec.trim() !== "") {
          const rank = specialtyRanks.get(spec) ?? specialtyTotal;
          specSum += normalize(rank, specialtyTotal);
          specCount++;
        }
      }

      const hospitalScore = hospCount > 0 ? hospSum / hospCount : 0;
      const specialtyScore = specCount > 0 ? specSum / specCount : 0;

      const score =
        weights.region * regionScore +
        weights.hospital * hospitalScore +
        weights.specialty * specialtyScore;

      return { job, score, regionScore, hospitalScore, specialtyScore };
    })
    .sort((a, b) => b.score - a.score);
}
