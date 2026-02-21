import type { Job } from "./parse-xlsx";
import type { SortableItem } from "@/components/sortable-list";
import { EPSILON, MIN_STDDEV_DIVISOR, MIN_NUDGE } from "@/lib/constants";

export interface ScoredJob {
  job: Job;
  score: number;
  scoreAdjustment: number;
  regionScore: number;
  hospitalScore: number;
  specialtyScore: number;
}

export function effectiveScore(sj: ScoredJob): number {
  return sj.score + (sj.scoreAdjustment ?? 0);
}

export function computeNudgeAmount(jobs: ScoredJob[]): number {
  if (jobs.length <= 1) return EPSILON;
  const scores = jobs.map((j) => effectiveScore(j));
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  return Math.max(stddev / MIN_STDDEV_DIVISOR, MIN_NUDGE);
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

export interface ScoreJobsOptions {
  jobs: Job[];
  rankedRegions: SortableItem[];
  globalHospitals: SortableItem[];
  rankedSpecialties: SortableItem[];
  weights: { region: number; hospital: number; specialty: number };
  lockRegions?: boolean;
}

export function scoreJobs(options: ScoreJobsOptions): ScoredJob[] {
  const {
    jobs,
    rankedRegions,
    globalHospitals,
    rankedSpecialties,
    weights,
    lockRegions = false,
  } = options;
  const regionRanks = buildRankMap(rankedRegions);
  const hospitalRanks = buildRankMap(globalHospitals);
  const specialtyRanks = buildRankMap(rankedSpecialties);

  const regionTotal = rankedRegions.length;
  const hospitalTotal = globalHospitals.length;
  const specialtyTotal = rankedSpecialties.length;

  const scored = jobs.map((job) => {
    const regionRank = regionRanks.get(job.region) ?? regionTotal;
    const regionScore = normalize(regionRank, regionTotal);

    let hospSum = 0;
    let hospCount = 0;
    let specSum = 0;
    let specCount = 0;

    for (const p of job.placements) {
      const site = p.site;
      if (site && site !== "None" && site.trim() !== "") {
        const rank = hospitalRanks.get(site) ?? hospitalTotal;
        hospSum += normalize(rank, hospitalTotal);
        hospCount++;
      }

      const spec = p.specialty;
      if (spec && spec !== "None" && spec.trim() !== "") {
        const rank = specialtyRanks.get(spec) ?? specialtyTotal;
        specSum += normalize(rank, specialtyTotal);
        specCount++;
      }
    }

    const hospitalScore = hospCount > 0 ? hospSum / hospCount : 0;
    const specialtyScore = specCount > 0 ? specSum / specCount : 0;

    const score = lockRegions
      ? weights.hospital * hospitalScore + weights.specialty * specialtyScore
      : weights.region * regionScore +
        weights.hospital * hospitalScore +
        weights.specialty * specialtyScore;

    return { job, score, scoreAdjustment: 0, regionScore, hospitalScore, specialtyScore };
  });

  if (lockRegions) {
    return scored.sort((a, b) => {
      const aRegionRank = regionRanks.get(a.job.region) ?? regionTotal + 1;
      const bRegionRank = regionRanks.get(b.job.region) ?? regionTotal + 1;
      if (aRegionRank !== bRegionRank) return aRegionRank - bRegionRank;
      return b.score - a.score;
    });
  }

  return scored.sort((a, b) => b.score - a.score);
}
