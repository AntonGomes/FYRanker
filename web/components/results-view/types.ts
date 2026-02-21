import type { ScoredJob } from "@/lib/scoring";

export type GhostData = {
  scored: ScoredJob;
  rank: number;
  fromRect: { top: number; left: number; width: number; height: number };
  direction: "up" | "down";
  targetY: number;
  offScreen: boolean;
};

export type CascadeGhostData = {
  scored: ScoredJob;
  rank: number;
  fromX: number;
  fromY: number;
  deltaX: number;
  deltaY: number;
  width: number;
  height: number;
  delay: number;
};

export interface FilterState {
  searchQuery: string;
  regionFilter: string;
  hospitalFilter: string;
  specialtyFilter: string;
}

export interface FilterActions {
  setSearchQuery: (v: string) => void;
  setRegionFilter: (v: string) => void;
  setHospitalFilter: (v: string) => void;
  setSpecialtyFilter: (v: string) => void;
  clearFilters: () => void;
}

export interface ToolbarProps {
  filteredCount: number;
  totalCount: number;
  filters: FilterState;
  filterActions: FilterActions;
  hasActiveFilters: boolean;
  allRegions: string[];
  allHospitals: string[];
  allSpecialties: string[];
  compareCount: number;
  onShowCompare: () => void;
  onExport: () => void;
  onImportClick: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onShowHelp: () => void;
}

export interface MobileToolbarProps extends ToolbarProps {
  mobileSearchOpen: boolean;
  setMobileSearchOpen: (v: boolean) => void;
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
}
