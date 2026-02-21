"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { SortableItem } from "@/components/sortable-list";
import { type EloState, initEloFromRanking } from "@/lib/elo";
import type { Job } from "@/lib/parse-xlsx";
import { scoreJobs } from "@/lib/scoring";
import type { SortMode } from "@/components/hospital-sort-dropdown";

import {
  STEP_GLOBAL_HOSPITALS,
  STEP_HOSPITALS,
  STEP_REGIONS,
  STEP_SPECIALTIES,
  STEP_WEIGHTS,
  TOTAL_STEPS,
  type SpecialtyPhase,
  type Weights,
} from "./wizard-constants";

export interface NavigationDeps {
  jobs: Job[] | null;
  rankedRegions: SortableItem[];
  hospitalsByRegion: Record<string, SortableItem[]>;
  rankedSpecialties: SortableItem[];
  globalHospitals: SortableItem[];
  setGlobalHospitals: (items: SortableItem[]) => void;
  lockRegions: boolean;
  movedSpecialtyIds: Set<string>;
  setEloState: (state: EloState | null) => void;
  weights: Weights;
}

export interface NavigationState {
  step: number;
  regionSubStep: number;
  specialtyPhase: SpecialtyPhase;
  sortMode: SortMode;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  searchOpen: boolean;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  handleNext: () => void;
  handleBack: () => void;
  getNextButtonLabel: () => string;
}

export function useWizardNavigation(deps: NavigationDeps): NavigationState {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [regionSubStep, setRegionSubStep] = useState(0);
  const [specialtyPhase, setSpecialtyPhase] = useState<SpecialtyPhase>("explainer");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function resetSearch(): void {
    setSearchOpen(false);
    setSearchQuery("");
  }

  function handleNext(): void {
    resetSearch();
    const ctx = { step, regionSubStep, specialtyPhase, deps, setStep, setRegionSubStep, setSortMode, setSpecialtyPhase, router };
    navigateForward(ctx);
  }

  function handleBack(): void {
    const ctx = { step, regionSubStep, specialtyPhase, setStep, setRegionSubStep, setSortMode, setSpecialtyPhase, resetSearch };
    navigateBackward(ctx);
  }

  function getNextButtonLabel(): string {
    if (step === TOTAL_STEPS) return "Calculate & View Results";
    if (step === STEP_SPECIALTIES && specialtyPhase === "explainer") return "Start Ranking";
    if (step === STEP_SPECIALTIES && specialtyPhase === "ranking") return "Continue to Refinement";
    return "Continue";
  }

  return {
    step, regionSubStep, specialtyPhase,
    sortMode, setSortMode,
    searchOpen, setSearchOpen,
    searchQuery, setSearchQuery,
    handleNext, handleBack, getNextButtonLabel,
  };
}

interface ForwardContext {
  step: number;
  regionSubStep: number;
  specialtyPhase: SpecialtyPhase;
  deps: NavigationDeps;
  setStep: (s: number) => void;
  setRegionSubStep: React.Dispatch<React.SetStateAction<number>>;
  setSortMode: (m: SortMode) => void;
  setSpecialtyPhase: (p: SpecialtyPhase) => void;
  router: ReturnType<typeof useRouter>;
}

function navigateForward(ctx: ForwardContext): void {
  switch (ctx.step) {
    case STEP_REGIONS:
      ctx.setRegionSubStep(0);
      ctx.setStep(STEP_HOSPITALS);
      break;
    case STEP_HOSPITALS:
      advanceHospital(ctx);
      break;
    case STEP_GLOBAL_HOSPITALS:
      ctx.setStep(STEP_SPECIALTIES);
      break;
    case STEP_SPECIALTIES:
      advanceSpecialty(ctx);
      break;
    case STEP_WEIGHTS:
      submitResults(ctx);
      break;
  }
}

function advanceHospital(ctx: ForwardContext): void {
  if (ctx.regionSubStep < ctx.deps.rankedRegions.length - 1) {
    ctx.setSortMode("default");
    ctx.setRegionSubStep((s) => s + 1);
  } else {
    ctx.deps.setGlobalHospitals(
      deriveGlobalList(ctx.deps.rankedRegions, ctx.deps.hospitalsByRegion),
    );
    ctx.setStep(STEP_GLOBAL_HOSPITALS);
  }
}

function advanceSpecialty(ctx: ForwardContext): void {
  if (ctx.specialtyPhase === "explainer") {
    ctx.setSpecialtyPhase("ranking");
  } else if (ctx.specialtyPhase === "ranking") {
    const seeded = initEloFromRanking(ctx.deps.rankedSpecialties, ctx.deps.movedSpecialtyIds);
    ctx.deps.setEloState(seeded);
    ctx.setSpecialtyPhase("refining");
  } else {
    ctx.setStep(STEP_WEIGHTS);
  }
}

function submitResults(ctx: ForwardContext): void {
  if (!ctx.deps.jobs) return;
  const scored = scoreJobs({
    jobs: ctx.deps.jobs,
    rankedRegions: ctx.deps.rankedRegions,
    globalHospitals: ctx.deps.globalHospitals,
    rankedSpecialties: ctx.deps.rankedSpecialties,
    weights: ctx.deps.weights,
    lockRegions: ctx.deps.lockRegions,
  });
  const json = JSON.stringify(scored);
  sessionStorage.setItem("fy_scored_jobs", json);
  localStorage.setItem("fy_scored_jobs", json);
  ctx.router.push("/results");
}

interface BackwardContext {
  step: number;
  regionSubStep: number;
  specialtyPhase: SpecialtyPhase;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  setRegionSubStep: React.Dispatch<React.SetStateAction<number>>;
  setSortMode: (m: SortMode) => void;
  setSpecialtyPhase: (p: SpecialtyPhase) => void;
  resetSearch: () => void;
}

function navigateBackward(ctx: BackwardContext): void {
  if (ctx.step === STEP_SPECIALTIES && ctx.specialtyPhase === "refining") {
    ctx.setSpecialtyPhase("ranking");
    return;
  }
  if (ctx.step === STEP_SPECIALTIES && ctx.specialtyPhase === "ranking") {
    ctx.setSpecialtyPhase("explainer");
    return;
  }
  if (ctx.step === STEP_HOSPITALS && ctx.regionSubStep > 0) {
    ctx.setSortMode("default");
    ctx.resetSearch();
    ctx.setRegionSubStep((s) => s - 1);
    return;
  }
  if (ctx.step === STEP_HOSPITALS) {
    ctx.setStep(STEP_REGIONS);
    return;
  }
  ctx.setStep((s) => s - 1);
}

function deriveGlobalList(
  rankedRegions: SortableItem[],
  hospitalsByRegion: Record<string, SortableItem[]>,
): SortableItem[] {
  const result: SortableItem[] = [];
  for (const region of rankedRegions) {
    const regionHospitals = hospitalsByRegion[region.id] || [];
    for (const hospital of regionHospitals) {
      result.push({
        id: `${hospital.id}__${region.id}`,
        label: hospital.label,
        badge: region.label,
      });
    }
  }
  return result;
}
