"use client";

import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

import { StepIndicator } from "@/components/wizard/step-indicator";
import { WizardHeader } from "@/components/wizard/wizard-header";
import { WizardFooter } from "@/components/wizard/wizard-footer";
import { WizardStepContent } from "@/components/wizard/wizard-step-content";
import type { WizardData } from "@/components/wizard/use-wizard-data";
import type { NavigationState } from "@/components/wizard/use-wizard-navigation";
import { getStepDescription } from "@/components/wizard/wizard-descriptions";
import {
  STEP_GLOBAL_HOSPITALS,
  STEP_HOSPITALS,
  STEP_REGIONS,
  STEP_SPECIALTIES,
  TOTAL_STEPS,
} from "@/components/wizard/wizard-constants";

import {
  buildHospitalSortProps,
  computeConfidence,
  isHospitalStep,
  type LocalState,
} from "./wizard-utils";

interface WizardShellProps {
  data: WizardData;
  local: LocalState;
  nav: NavigationState;
}

function useDerivedValues(props: WizardShellProps) {
  const { data, local, nav } = props;
  const currentRegion = data.rankedRegions[nav.regionSubStep];
  const currentHospitals = currentRegion
    ? data.hospitalsByRegion[currentRegion.id] ?? []
    : [];

  const description = getStepDescription({
    step: nav.step,
    regionSubStep: nav.regionSubStep,
    rankedRegions: data.rankedRegions,
    currentHospitals,
    globalHospitals: local.globalHospitals,
    lockRegions: local.lockRegions,
    specialtyPhase: nav.specialtyPhase,
  });

  const showSearchToolbar =
    nav.step === STEP_HOSPITALS ||
    nav.step === STEP_GLOBAL_HOSPITALS ||
    (nav.step === STEP_SPECIALTIES && nav.specialtyPhase === "ranking");

  const showBackButton =
    nav.step > STEP_REGIONS ||
    (nav.step === STEP_SPECIALTIES && nav.specialtyPhase !== "explainer");

  const confidencePercentage = computeConfidence({
    eloState: local.eloState,
    movedCount: local.movedSpecialtyIds.size,
  });

  const hospitalSortProps = isHospitalStep({ step: nav.step, currentRegion })
    ? buildHospitalSortProps({ currentRegion, currentHospitals, data, local, nav })
    : undefined;

  return {
    currentRegion, currentHospitals, description,
    showSearchToolbar, showBackButton,
    confidencePercentage, hospitalSortProps,
  };
}

export function WizardShell(props: WizardShellProps): React.ReactElement {
  const derived = useDerivedValues(props);

  return (
    <div className="flex h-dvh flex-col bg-background overflow-hidden">
      <SiteHeader />
      <main className="flex-1 flex flex-col items-center min-h-0 px-2 py-2 sm:px-4 sm:py-3">
        <div className="w-full max-w-2xl flex flex-col min-h-0 flex-1 gap-2">
          <div className="px-1 shrink-0">
            <StepIndicator currentStep={props.nav.step} totalSteps={TOTAL_STEPS} />
          </div>
          <WizardCard {...props} derived={derived} />
        </div>
      </main>
      <SiteFooter className="hidden sm:block" />
    </div>
  );
}

type DerivedValues = ReturnType<typeof useDerivedValues>;

interface WizardCardProps extends WizardShellProps {
  derived: DerivedValues;
}

function WizardCard(props: WizardCardProps): React.ReactElement {
  const { nav, derived } = props;

  return (
    <Card className="shadow-lg min-h-0 flex-1 gap-0 py-0">
      <WizardHeader
        step={nav.step}
        description={derived.description}
        currentRegion={derived.currentRegion}
        specialtyPhase={nav.specialtyPhase}
        confidencePercentage={derived.confidencePercentage}
        showSearchToolbar={derived.showSearchToolbar}
        searchOpen={nav.searchOpen}
        searchQuery={nav.searchQuery}
        onSearchOpenChange={nav.setSearchOpen}
        onSearchQueryChange={nav.setSearchQuery}
        hospitalSortProps={derived.hospitalSortProps}
      />
      <StepContentSection {...props} />
      <WizardFooter
        showBackButton={derived.showBackButton}
        nextLabel={nav.getNextButtonLabel()}
        onBack={nav.handleBack}
        onNext={nav.handleNext}
      />
    </Card>
  );
}

function StepContentSection(props: WizardCardProps): React.ReactElement {
  const { data, local, nav, derived } = props;

  return (
    <WizardStepContent
      step={nav.step}
      specialtyPhase={nav.specialtyPhase}
      rankedRegions={data.rankedRegions}
      setRankedRegions={data.setRankedRegions}
      currentRegion={derived.currentRegion}
      currentHospitals={derived.currentHospitals}
      onHospitalReorder={(items) => {
        if (!derived.currentRegion) return;
        data.setHospitalsByRegion((prev) => ({
          ...prev,
          [derived.currentRegion.id]: items,
        }));
      }}
      globalHospitals={local.globalHospitals}
      setGlobalHospitals={local.setGlobalHospitals}
      lockRegions={local.lockRegions}
      setLockRegions={local.setLockRegions}
      rankedSpecialties={data.rankedSpecialties}
      setRankedSpecialties={data.setRankedSpecialties}
      onSpecialtyMoved={(id) =>
        local.setMovedSpecialtyIds((prev) => new Set(prev).add(id))
      }
      eloState={local.eloState}
      setEloState={local.setEloState}
      movedSpecialtyIds={local.movedSpecialtyIds}
      weights={local.weights}
      setWeights={local.setWeights}
      searchQuery={nav.searchQuery}
    />
  );
}
