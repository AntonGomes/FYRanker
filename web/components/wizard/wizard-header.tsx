import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HospitalSortDropdown, type SortMode } from "@/components/hospital-sort-dropdown";
import type { SortableItem } from "@/components/sortable-list";
import { getRegionStyle } from "@/lib/region-colors";
import type { Hospital, UserLocation } from "@/lib/proximity";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

import { ConfidenceRing } from "./confidence-ring";
import { SearchToolbar } from "./search-toolbar";
import {
  STEP_HOSPITALS,
  STEP_SPECIALTIES,
  STEPS,
  TOTAL_STEPS,
} from "./wizard-constants";

interface WizardHeaderProps {
  step: number;
  description: string;
  currentRegion: SortableItem | undefined;
  specialtyPhase: string;
  confidencePercentage: number;
  showSearchToolbar: boolean;
  searchOpen: boolean;
  searchQuery: string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  hospitalSortProps: HospitalSortProps | undefined;
}

interface HospitalSortProps {
  items: SortableItem[];
  onSort: (items: SortableItem[]) => void;
  userLocation: UserLocation | null;
  onLocationChange: (loc: UserLocation | null) => void;
  hospitals: Hospital[];
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
}

function StepIconBadge({ step }: { step: number }): React.ReactElement | null {
  const StepIcon = STEPS[step - 1]?.icon;
  if (!StepIcon) return null;
  return (
    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
      <StepIcon className="h-4.5 w-4.5 text-primary" />
    </div>
  );
}

function RegionBadge({ region }: { region: SortableItem }): React.ReactElement {
  const style = getRegionStyle(region.id);
  return (
    <div className={cn(
      "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
      style.bg, style.border, style.text,
    )}>
      <MapPin className="h-3 w-3" />
      {region.label}
    </div>
  );
}

export function WizardHeader({
  step,
  description,
  currentRegion,
  specialtyPhase,
  confidencePercentage,
  showSearchToolbar,
  searchOpen,
  searchQuery,
  onSearchOpenChange,
  onSearchQueryChange,
  hospitalSortProps,
}: WizardHeaderProps): React.ReactElement {
  return (
    <CardHeader className="shrink-0 py-4 sm:py-5">
      <div className="flex items-center gap-3">
        <StepIconBadge step={step} />
        <div>
          <p className="text-xs text-muted-foreground font-medium">
            Step {step} of {TOTAL_STEPS}
          </p>
          <CardTitle className="text-lg">
            {STEPS[step - 1]?.title}
          </CardTitle>
        </div>
        {step === STEP_HOSPITALS && currentRegion && (
          <RegionBadge region={currentRegion} />
        )}
        {step === STEP_SPECIALTIES && specialtyPhase === "refining" && (
          <ConfidenceRing percentage={confidencePercentage} />
        )}
      </div>
      <HeaderDescription
        description={description}
        showSearchToolbar={showSearchToolbar}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        onSearchOpenChange={onSearchOpenChange}
        onSearchQueryChange={onSearchQueryChange}
        hospitalSortProps={hospitalSortProps}
      />
    </CardHeader>
  );
}

function HeaderDescription({
  description,
  showSearchToolbar,
  searchOpen,
  searchQuery,
  onSearchOpenChange,
  onSearchQueryChange,
  hospitalSortProps,
}: {
  description: string;
  showSearchToolbar: boolean;
  searchOpen: boolean;
  searchQuery: string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  hospitalSortProps: HospitalSortProps | undefined;
}): React.ReactElement {
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <CardDescription className="flex-1">
          {description}
        </CardDescription>
        {showSearchToolbar && (
          <SearchToolbar
            searchOpen={searchOpen}
            searchQuery={searchQuery}
            onSearchOpenChange={onSearchOpenChange}
            onSearchQueryChange={onSearchQueryChange}
            sortDropdown={hospitalSortProps ? (
              <HospitalSortDropdown
                items={hospitalSortProps.items}
                onSort={hospitalSortProps.onSort}
                userLocation={hospitalSortProps.userLocation}
                onLocationChange={hospitalSortProps.onLocationChange}
                hospitals={hospitalSortProps.hospitals}
                sortMode={hospitalSortProps.sortMode}
                onSortModeChange={hospitalSortProps.onSortModeChange}
              />
            ) : undefined}
          />
        )}
      </div>
    </div>
  );
}

export type { HospitalSortProps };
