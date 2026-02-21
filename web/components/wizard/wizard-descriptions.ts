import type { SortableItem } from "@/components/sortable-list";

import {
  STEP_GLOBAL_HOSPITALS,
  STEP_HOSPITALS,
  STEP_REGIONS,
  STEP_SPECIALTIES,
  STEP_WEIGHTS,
  type SpecialtyPhase,
} from "./wizard-constants";

interface DescriptionParams {
  step: number;
  regionSubStep: number;
  rankedRegions: SortableItem[];
  currentHospitals: SortableItem[];
  globalHospitals: SortableItem[];
  lockRegions: boolean;
  specialtyPhase: SpecialtyPhase;
}

export function getStepDescription(params: DescriptionParams): string {
  switch (params.step) {
    case STEP_REGIONS:
      return "Drag to reorder by preference.";
    case STEP_HOSPITALS:
      return getHospitalDescription(params);
    case STEP_GLOBAL_HOSPITALS:
      return getGlobalHospitalDescription(params);
    case STEP_SPECIALTIES:
      return getSpecialtyDescription(params.specialtyPhase);
    case STEP_WEIGHTS:
      return getWeightDescription(params.lockRegions);
    default:
      return "";
  }
}

function getHospitalDescription(params: DescriptionParams): string {
  const count = params.currentHospitals.length;
  const suffix = count !== 1 ? "s" : "";
  return `${params.regionSubStep + 1}/${params.rankedRegions.length} · ${count} hospital${suffix}`;
}

function getGlobalHospitalDescription(params: DescriptionParams): string {
  if (params.lockRegions) return "Regions locked — hospitals stay within their region.";
  return `${params.globalHospitals.length} hospitals across all regions.`;
}

function getSpecialtyDescription(phase: SpecialtyPhase): string {
  if (phase === "refining") return "Pick your preference to sharpen your ranking.";
  if (phase === "ranking") return "Drag to reorder by preference.";
  return "How specialty ranking works.";
}

function getWeightDescription(lockRegions: boolean): string {
  if (lockRegions) return "Region order fixed. Adjust hospital and specialty weight.";
  return "Adjust how much each factor matters.";
}
