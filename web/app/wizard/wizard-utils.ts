import type { SortableItem } from "@/components/sortable-list";
import type { EloState } from "@/lib/elo";
import { getConfidence } from "@/lib/elo";
import type { UserLocation } from "@/lib/proximity";
import type { HospitalSortProps } from "@/components/wizard/wizard-header";
import type { WizardData } from "@/components/wizard/use-wizard-data";
import type { NavigationState } from "@/components/wizard/use-wizard-navigation";
import {
  PERCENTAGE,
  STEP_HOSPITALS,
  type Weights,
} from "@/components/wizard/wizard-constants";

export interface LocalState {
  globalHospitals: SortableItem[];
  setGlobalHospitals: React.Dispatch<React.SetStateAction<SortableItem[]>>;
  lockRegions: boolean;
  setLockRegions: React.Dispatch<React.SetStateAction<boolean>>;
  eloState: EloState | null;
  setEloState: React.Dispatch<React.SetStateAction<EloState | null>>;
  movedSpecialtyIds: Set<string>;
  setMovedSpecialtyIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  userLocation: UserLocation | null;
  setUserLocation: React.Dispatch<React.SetStateAction<UserLocation | null>>;
  weights: Weights;
  setWeights: React.Dispatch<React.SetStateAction<Weights>>;
}

interface HospitalSortConfig {
  currentRegion: SortableItem;
  currentHospitals: SortableItem[];
  data: WizardData;
  local: LocalState;
  nav: NavigationState;
}

export function buildHospitalSortProps(config: HospitalSortConfig): HospitalSortProps {
  return {
    items: config.currentHospitals,
    onSort: (sortedItems) => {
      config.data.setHospitalsByRegion((prev) => ({
        ...prev,
        [config.currentRegion.id]: sortedItems,
      }));
    },
    userLocation: config.local.userLocation,
    onLocationChange: config.local.setUserLocation,
    hospitals: config.data.hospitals,
    sortMode: config.nav.sortMode,
    onSortModeChange: config.nav.setSortMode,
  };
}

export function computeConfidence(config: {
  eloState: EloState | null;
  movedCount: number;
}): number {
  if (!config.eloState) return 0;
  return Math.round(getConfidence(config.eloState, config.movedCount) * PERCENTAGE);
}

export function isHospitalStep(config: {
  step: number;
  currentRegion: SortableItem | undefined;
}): config is { step: number; currentRegion: SortableItem } {
  return config.step === STEP_HOSPITALS && config.currentRegion !== undefined;
}
