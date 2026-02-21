"use client";

import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RankableList } from "@/components/rankable-list";
import type { SortableItem } from "@/components/sortable-list";
import { SortableList } from "@/components/sortable-list";
import { Switch } from "@/components/ui/switch";
import type { EloState } from "@/lib/elo";
import { getRegionStyle } from "@/lib/region-colors";
import { cn } from "@/lib/utils";
import { SpecialtyDuel } from "@/components/specialty-duel";
import { SpecialtyExplainer } from "@/components/specialty-explainer";

import { WeightDistribution } from "./weight-distribution";
import { WeightSlider } from "./weight-slider";
import {
  STEP_GLOBAL_HOSPITALS,
  STEP_HOSPITALS,
  STEP_REGIONS,
  STEP_SPECIALTIES,
  STEP_WEIGHTS,
  WEIGHT_FIELDS,
  type SpecialtyPhase,
  type Weights,
} from "./wizard-constants";

interface WizardStepContentProps {
  step: number;
  specialtyPhase: SpecialtyPhase;
  rankedRegions: SortableItem[];
  setRankedRegions: (items: SortableItem[]) => void;
  currentRegion: SortableItem | undefined;
  currentHospitals: SortableItem[];
  onHospitalReorder: (items: SortableItem[]) => void;
  globalHospitals: SortableItem[];
  setGlobalHospitals: (items: SortableItem[]) => void;
  lockRegions: boolean;
  setLockRegions: (v: boolean) => void;
  rankedSpecialties: SortableItem[];
  setRankedSpecialties: (items: SortableItem[]) => void;
  onSpecialtyMoved: (id: string) => void;
  eloState: EloState | null;
  setEloState: (state: EloState | null) => void;
  movedSpecialtyIds: Set<string>;
  weights: Weights;
  setWeights: React.Dispatch<React.SetStateAction<Weights>>;
  searchQuery: string;
}

export function WizardStepContent(props: WizardStepContentProps): React.ReactElement {
  const overflowClass = props.step === STEP_SPECIALTIES && props.specialtyPhase === "refining"
    ? "overflow-x-clip overflow-y-visible"
    : "overflow-hidden";

  return (
    <CardContent className={cn("flex-1 min-h-0 flex flex-col pb-0", overflowClass)}>
      {props.step === STEP_REGIONS && <RegionsStep {...props} />}
      {props.step === STEP_HOSPITALS && <HospitalsStep {...props} />}
      {props.step === STEP_GLOBAL_HOSPITALS && <GlobalHospitalsStep {...props} />}
      {props.step === STEP_SPECIALTIES && <SpecialtiesStep {...props} />}
      {props.step === STEP_WEIGHTS && <WeightsStep {...props} />}
    </CardContent>
  );
}

function RegionsStep({ rankedRegions, setRankedRegions }: WizardStepContentProps): React.ReactElement {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <SortableList
        items={rankedRegions.map((r) => ({
          ...r,
          regionStyle: getRegionStyle(r.id),
        }))}
        onReorder={(items) =>
          setRankedRegions(items.map(({ id, label }) => ({ id, label })))
        }
      />
    </div>
  );
}

function HospitalsStep({
  currentRegion,
  currentHospitals,
  onHospitalReorder,
  searchQuery,
}: WizardStepContentProps): React.ReactElement | null {
  if (!currentRegion) return null;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <RankableList
        items={currentHospitals}
        onReorder={onHospitalReorder}
        searchFilter={searchQuery}
      />
    </div>
  );
}

function GlobalHospitalsStep({
  globalHospitals,
  setGlobalHospitals,
  lockRegions,
  setLockRegions,
  searchQuery,
}: WizardStepContentProps): React.ReactElement {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center gap-3 rounded-lg border px-4 py-3 shrink-0">
        <Switch
          id="lock-regions"
          checked={lockRegions}
          onCheckedChange={setLockRegions}
        />
        <Label htmlFor="lock-regions" className="cursor-pointer leading-snug">
          <span className="font-medium">Keep regions separate</span>
          <span className="block text-xs text-muted-foreground">
            Hospitals stay within their region order — no cross-region mixing
          </span>
        </Label>
      </div>
      {!lockRegions && (
        <div className="flex flex-col flex-1 min-h-0">
          <RankableList
            items={globalHospitals}
            onReorder={setGlobalHospitals}
            searchFilter={searchQuery}
          />
        </div>
      )}
    </div>
  );
}

function SpecialtiesStep({
  specialtyPhase,
  rankedSpecialties,
  setRankedSpecialties,
  onSpecialtyMoved,
  eloState,
  setEloState,
  movedSpecialtyIds,
  searchQuery,
}: WizardStepContentProps): React.ReactElement {
  return (
    <>
      {specialtyPhase === "explainer" && (
        <SpecialtyExplainer specialtyCount={rankedSpecialties.length} />
      )}
      {specialtyPhase === "ranking" && (
        <div className="flex flex-col flex-1 min-h-0">
          <RankableList
            items={rankedSpecialties}
            onReorder={setRankedSpecialties}
            onItemMoved={onSpecialtyMoved}
            searchFilter={searchQuery}
          />
        </div>
      )}
      {specialtyPhase === "refining" && (
        <SpecialtyDuel
          specialties={rankedSpecialties.map((s) => s.label)}
          eloState={eloState}
          onStateChange={setEloState}
          onRankingChange={setRankedSpecialties}
          movedIds={movedSpecialtyIds}
        />
      )}
    </>
  );
}

function WeightsStep({ weights, setWeights, lockRegions }: WizardStepContentProps): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="space-y-5">
        {WEIGHT_FIELDS
          .filter((f) => !(lockRegions && f.key === "region"))
          .map((f) => (
            <WeightSlider
              key={f.key}
              icon={f.icon}
              label={f.label}
              value={weights[f.key]}
              onChange={(v) => setWeights((w) => ({ ...w, [f.key]: v }))}
            />
          ))}
      </div>
      <WeightDistribution weights={weights} lockRegions={lockRegions} />
    </div>
  );
}
