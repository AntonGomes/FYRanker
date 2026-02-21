import { Building2, Globe, MapPin, SlidersHorizontal, Stethoscope } from "lucide-react";

import type { SortableItem } from "@/components/sortable-list";

export type SpecialtyPhase = "explainer" | "ranking" | "refining";

export const STEPS = [
  { title: "Rank Regions", icon: MapPin, description: "Order regions by preference" },
  { title: "Rank Hospitals", icon: Building2, description: "Order hospitals within each region" },
  { title: "Global Hospital Ranking", icon: Globe, description: "Fine-tune the overall hospital order" },
  { title: "Rank Specialties", icon: Stethoscope, description: "Order specialties by preference" },
  { title: "Set Weights", icon: SlidersHorizontal, description: "Decide what matters most to you" },
] as const;

export const TOTAL_STEPS = STEPS.length;

export const STEP_REGIONS = 1;
export const STEP_HOSPITALS = 2;
export const STEP_GLOBAL_HOSPITALS = 3;
export const STEP_SPECIALTIES = 4;
export const STEP_WEIGHTS = 5;

export const RING_CIRCUMFERENCE = 94.25;
export const PERCENTAGE = 100;

export const WEIGHT_FIELDS = [
  { key: "region" as const, label: "Region", icon: MapPin, color: "bg-blue-400" },
  { key: "hospital" as const, label: "Hospital", icon: Building2, color: "bg-amber-400" },
  { key: "specialty" as const, label: "Specialty", icon: Stethoscope, color: "bg-emerald-400" },
] as const;

export type Weights = { region: number; hospital: number; specialty: number };

export function toItems(arr: string[]): SortableItem[] {
  return arr.map((s) => ({ id: s, label: s }));
}
