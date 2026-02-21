import * as XLSX from "xlsx";
import type { ScoredJob } from "./scoring";
import { effectiveScore } from "./scoring";
import { PLACEMENTS_PER_JOB, SCORE_DECIMAL_PLACES } from "@/lib/constants";

const REGIONS = ["East", "West", "North", "South and SE"] as const;

function buildRow(sj: ScoredJob, rank: number) {
  const row: Record<string, string | number> = {
    Rank: rank,
    Score: Number(effectiveScore(sj).toFixed(SCORE_DECIMAL_PLACES)),
    "Score Adjustment": Number((sj.scoreAdjustment ?? 0).toFixed(SCORE_DECIMAL_PLACES)),
    "Region Score": Number(sj.regionScore.toFixed(SCORE_DECIMAL_PLACES)),
    "Hospital Score": Number(sj.hospitalScore.toFixed(SCORE_DECIMAL_PLACES)),
    "Specialty Score": Number(sj.specialtyScore.toFixed(SCORE_DECIMAL_PLACES)),
    "Programme Title": sj.job.programmeTitle,
    Region: sj.job.region,
  };

  for (let i = 0; i < PLACEMENTS_PER_JOB; i++) {
    const p = sj.job.placements[i];
    const n = i + 1;
    row[`Placement ${n}: Site`] = p?.site ?? "";
    row[`Placement ${n}: Specialty`] = p?.specialty ?? "";
    row[`Placement ${n}: Description`] = p?.description ?? "";
  }

  return row;
}

function buildSheet(jobs: ScoredJob[]) {
  const sorted = [...jobs].sort(
    (a, b) => effectiveScore(b) - effectiveScore(a)
  );
  const rows = sorted.map((sj, i) => buildRow(sj, i + 1));
  return XLSX.utils.json_to_sheet(rows);
}

export function exportRankingsToXlsx(rankedJobs: ScoredJob[]): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSheet(rankedJobs), "All Programmes");


  for (const region of REGIONS) {
    const regionJobs = rankedJobs.filter((sj) => sj.job.region === region);
    if (regionJobs.length > 0) {
      XLSX.utils.book_append_sheet(wb, buildSheet(regionJobs), region);
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `fy-rankings-${date}.xlsx`);
}
