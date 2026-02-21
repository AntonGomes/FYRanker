import * as XLSX from "xlsx";
import type { ScoredJob } from "./scoring";
import type { Job, Placement } from "./parse-xlsx";
import { PLACEMENTS_PER_JOB } from "@/lib/constants";

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

function parseRow(row: Record<string, unknown>): ScoredJob {
  const placements: Placement[] = [];
  for (let i = 1; i <= PLACEMENTS_PER_JOB; i++) {
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
  return {
    job,
    score: score - scoreAdjustment,
    scoreAdjustment,
    regionScore: Number(row["Region Score"] ?? 0),
    hospitalScore: Number(row["Hospital Score"] ?? 0),
    specialtyScore: Number(row["Specialty Score"] ?? 0),
  };
}

function validateSheet(wb: XLSX.WorkBook) {
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
  const missing = REQUIRED_COLUMNS.filter((col) => !(col in rows[0]));
  if (missing.length > 0) {
    throw new ImportError(`Missing required columns: ${missing.join(", ")}`);
  }
  return rows;
}

export async function importRankingsFromXlsx(file: File): Promise<ScoredJob[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const rows = validateSheet(wb);
  return rows.map(parseRow);
}
