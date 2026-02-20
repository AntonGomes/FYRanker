import * as XLSX from "xlsx";
import type { ScoredJob } from "./scoring";
import type { Job, Placement } from "./parse-xlsx";

const REQUIRED_COLUMNS = [
  "Rank",
  "Score",
  "Score Adjustment",
  "Region Score",
  "Hospital Score",
  "Specialty Score",
  "Programme Title",
  "Region",
];

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export async function importRankingsFromXlsx(
  file: File
): Promise<ScoredJob[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const sheetName = wb.SheetNames.find((n) => n === "All Programmes");
  if (!sheetName) {
    throw new ImportError(
      'Missing "All Programmes" sheet. This doesn\'t look like a FY Rankings export.'
    );
  }

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  if (rows.length === 0) {
    throw new ImportError("The All Programmes sheet is empty.");
  }

  // Validate columns
  const firstRow = rows[0];
  const missing = REQUIRED_COLUMNS.filter((col) => !(col in firstRow));
  if (missing.length > 0) {
    throw new ImportError(
      `Missing required columns: ${missing.join(", ")}`
    );
  }

  const scoredJobs: ScoredJob[] = rows.map((row) => {
    const placements: Placement[] = [];
    for (let i = 1; i <= 6; i++) {
      placements.push({
        site: String(row[`Placement ${i}: Site`] ?? ""),
        specialty: String(row[`Placement ${i}: Specialty`] ?? ""),
        description: String(row[`Placement ${i}: Description`] ?? ""),
      });
    }

    const job: Job = {
      programmeTitle: String(row["Programme Title"] ?? ""),
      deanery: "",
      region: String(row["Region"] ?? "") as Job["region"],
      placements,
    };

    const score = Number(row["Score"] ?? 0);
    const scoreAdjustment = Number(row["Score Adjustment"] ?? 0);
    const regionScore = Number(row["Region Score"] ?? 0);
    const hospitalScore = Number(row["Hospital Score"] ?? 0);
    const specialtyScore = Number(row["Specialty Score"] ?? 0);

    return {
      job,
      score: score - scoreAdjustment, // base score = effective - adjustment
      scoreAdjustment,
      regionScore,
      hospitalScore,
      specialtyScore,
    };
  });

  return scoredJobs;
}
