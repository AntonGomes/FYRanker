import type { Region } from "./region-colors";

export interface OverviewData {
  rotations: number;
  sites: number;
  specialties: number;
}

export interface RegionStats {
  rotations: number;
  sites: number;
  specialties: number;
}
export type RegionsData = Record<Region, RegionStats>;

export interface SpecialtyTierEntry {
  name: string;
  count: number;
  pct: number;
  tier: "Legendary" | "Epic" | "Rare" | "Uncommon" | "Common";
  tierColor: string;
}
export interface SpecialtyTiersData {
  all: SpecialtyTierEntry[];
  byRegion: Record<Region, SpecialtyTierEntry[]>;
}

export interface FYSpecialtyEntry {
  name: string;
  count: number;
  pct: number;
}
export interface FYData {
  all: FYSpecialtyEntry[];
  byRegion: Record<Region, FYSpecialtyEntry[]>;
}
export interface FYComparisonData {
  fy1: FYData;
  fy2: FYData;
}

export interface PlacementDistEntry {
  name: string;
  distribution: Record<string, number>;
  byRegion: Record<
    Region,
    { totalJobs: number; distribution: Record<string, number> }
  >;
}
export interface PlacementDistData {
  totalJobs: number;
  specialties: PlacementDistEntry[];
}

export interface CohortEntry {
  site: string;
  specialty: string;
  placement: number;
  count: number;
}
export interface RegionCohorts {
  largest: CohortEntry[];
  smallest: CohortEntry[];
}
export type CohortsData = Record<Region, RegionCohorts>;

export interface BlogData {
  overview: OverviewData;
  regions: RegionsData;
  specialtyTiers: SpecialtyTiersData;
  fyComparison: FYComparisonData;
  placementDist: PlacementDistData;
  cohorts: CohortsData;
}
