import * as XLSX from "xlsx";

export interface Placement {
  site: string;
  speciality: string;
  description?: string;
}

export interface Job {
  id: string;
  programme_title: string;
  region: "West" | "East" | "North" | "South and SE";
  placement_1: Placement;
  placement_2: Placement;
  placement_3: Placement;
  placement_4: Placement;
  placement_5: Placement;
  placement_6: Placement;
}

function placementFromRow(row: Record<string, unknown>, n: number): Placement {
  return {
    site: (row[`Placement ${n}: Site`] ?? row[`Placement ${n} Site`] ?? "None") as string,
    speciality: (row[`Placement ${n}: Specialty`] ?? row[`Placement ${n}: Speciality`] ?? row[`Placement ${n} Specialty`] ?? "None") as string,
    description: (row[`Placement ${n}: Description`] ?? row[`Placement ${n} Description`] ?? "None") as string,
  };
}

export function parseXlsx(buffer: ArrayBuffer): Job[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const all: Job[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "None",
    });

    for (const row of rows) {
      const job: Job = {
        id: crypto.randomUUID(),
        programme_title: row["Programme Title"] as string,
        region: sheetName as Job["region"],
        placement_1: placementFromRow(row, 1),
        placement_2: placementFromRow(row, 2),
        placement_3: placementFromRow(row, 3),
        placement_4: placementFromRow(row, 4),
        placement_5: placementFromRow(row, 5),
        placement_6: placementFromRow(row, 6),
      };

      all.push(job);
    }
  }

  return all;
}