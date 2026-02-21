"use client";

import { useState } from "react";

import type { SortableItem } from "@/components/sortable-list";
import type { EloState } from "@/lib/elo";
import type { UserLocation } from "@/lib/proximity";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

import { useWizardData } from "@/components/wizard/use-wizard-data";
import { useWizardNavigation } from "@/components/wizard/use-wizard-navigation";
import { type Weights } from "@/components/wizard/wizard-constants";

import { WizardShell } from "./wizard-shell";
import type { LocalState } from "./wizard-utils";

function LoadingScreen(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading programme data...</p>
      </main>
      <SiteFooter />
    </div>
  );
}

function useLocalState(): LocalState {
  const [globalHospitals, setGlobalHospitals] = useState<SortableItem[]>([]);
  const [lockRegions, setLockRegions] = useState(false);
  const [eloState, setEloState] = useState<EloState | null>(null);
  const [movedSpecialtyIds, setMovedSpecialtyIds] = useState<Set<string>>(new Set());
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [weights, setWeights] = useState<Weights>({ region: 0.33, hospital: 0.33, specialty: 0.33 });

  return {
    globalHospitals, setGlobalHospitals,
    lockRegions, setLockRegions,
    eloState, setEloState,
    movedSpecialtyIds, setMovedSpecialtyIds,
    userLocation, setUserLocation,
    weights, setWeights,
  };
}

export default function WizardPage(): React.ReactElement {
  const data = useWizardData();
  const local = useLocalState();

  const nav = useWizardNavigation({
    jobs: data.jobs,
    rankedRegions: data.rankedRegions,
    hospitalsByRegion: data.hospitalsByRegion,
    rankedSpecialties: data.rankedSpecialties,
    globalHospitals: local.globalHospitals,
    setGlobalHospitals: local.setGlobalHospitals,
    lockRegions: local.lockRegions,
    movedSpecialtyIds: local.movedSpecialtyIds,
    setEloState: local.setEloState,
    weights: local.weights,
  });

  if (data.loading) return <LoadingScreen />;

  return <WizardShell data={data} local={local} nav={nav} />;
}
