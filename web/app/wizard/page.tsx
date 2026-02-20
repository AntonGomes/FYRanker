"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SortableList, type SortableItem } from "@/components/sortable-list";
import { RankableList } from "@/components/rankable-list";
import type { Job } from "@/lib/parse-xlsx";
import { loadJobs } from "@/lib/parse-csv";
import { extractUniqueValues } from "@/lib/extract";
import { scoreJobs } from "@/lib/scoring";
import { REGION_COLORS } from "@/components/job-detail-panel";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HospitalSortDropdown, type SortMode } from "@/components/hospital-sort-dropdown";
import type { Hospital, UserLocation } from "@/lib/proximity";
import { SpecialtyDuel } from "@/components/specialty-duel";
import { SpecialtyExplainer } from "@/components/specialty-explainer";
import { type EloState, initEloFromRanking, getConfidence } from "@/lib/elo";
import {
  MapPin,
  Building2,
  Globe,
  Stethoscope,
  SlidersHorizontal,
  Search,
  X,
} from "lucide-react";

type SpecialtyPhase = "explainer" | "ranking" | "refining";

const STEPS = [
  { title: "Rank Regions", icon: MapPin, description: "Order regions by preference" },
  { title: "Rank Hospitals", icon: Building2, description: "Order hospitals within each region" },
  { title: "Global Hospital Ranking", icon: Globe, description: "Fine-tune the overall hospital order" },
  { title: "Rank Specialties", icon: Stethoscope, description: "Order specialties by preference" },
  { title: "Set Weights", icon: SlidersHorizontal, description: "Decide what matters most to you" },
];

const TOTAL_STEPS = STEPS.length;

function toItems(arr: string[]): SortableItem[] {
  return arr.map((s) => ({ id: s, label: s }));
}

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center gap-1.5 w-full">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 flex-1 rounded-full transition-all duration-300",
            i + 1 <= currentStep ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 1: Rank Regions
  const [rankedRegions, setRankedRegions] = useState<SortableItem[]>([]);
  // Step 2: Rank Hospitals per region
  const [hospitalsByRegion, setHospitalsByRegion] = useState<
    Record<string, SortableItem[]>
  >({});
  const [regionSubStep, setRegionSubStep] = useState(0);
  // Step 3: Global Hospital Ranking
  const [globalHospitals, setGlobalHospitals] = useState<SortableItem[]>([]);
  const [lockRegions, setLockRegions] = useState(false);
  // Step 4: Rank Specialties (ELO duel)
  const [rankedSpecialties, setRankedSpecialties] = useState<SortableItem[]>(
    []
  );
  const [eloState, setEloState] = useState<EloState | null>(null);
  const [movedSpecialtyIds, setMovedSpecialtyIds] = useState<Set<string>>(
    new Set()
  );
  const [specialtyPhase, setSpecialtyPhase] = useState<SpecialtyPhase>("explainer");
  // Proximity sorting
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Step 5: Set Weights
  const [weights, setWeights] = useState({
    region: 0.33,
    hospital: 0.33,
    specialty: 0.33,
  });

  // Load jobs from static CSV and hospital location data on mount
  useEffect(() => {
    Promise.all([
      loadJobs(),
      fetch("/hospitals.json").then((r) => r.json() as Promise<Hospital[]>),
    ]).then(([parsed, hospitalData]) => {
      setJobs(parsed);
      setHospitals(hospitalData);

      const data = extractUniqueValues(parsed);
      setRankedRegions(toItems(data.regions));
      const byRegion: Record<string, SortableItem[]> = {};
      for (const [region, hosps] of Object.entries(data.hospitalsByRegion)) {
        byRegion[region] = toItems(hosps);
      }
      setHospitalsByRegion(byRegion);
      setRankedSpecialties(toItems(data.specialties));
      setLoading(false);
    });
  }, []);

  // Derive global hospitals from region + per-region rankings
  function deriveGlobalHospitals(): SortableItem[] {
    const result: SortableItem[] = [];
    for (const region of rankedRegions) {
      const hospitals = hospitalsByRegion[region.id] || [];
      for (const hospital of hospitals) {
        result.push({
          id: `${hospital.id}__${region.id}`,
          label: hospital.label,
          badge: region.label,
        });
      }
    }
    return result;
  }

  // Navigation
  function handleNext() {
    setSearchOpen(false);
    setSearchQuery("");
    if (step === 1) {
      setRegionSubStep(0);
      setStep(2);
    } else if (step === 2) {
      if (regionSubStep < rankedRegions.length - 1) {
        setSortMode("default");
        setSearchOpen(false);
        setSearchQuery("");
        setRegionSubStep((s) => s + 1);
      } else {
        setGlobalHospitals(deriveGlobalHospitals());
        setStep(3);
      }
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (specialtyPhase === "explainer") {
        setSpecialtyPhase("ranking");
      } else if (specialtyPhase === "ranking") {
        // Seed ELO from DnD ranking and enter refinement
        const seeded = initEloFromRanking(rankedSpecialties, movedSpecialtyIds);
        setEloState(seeded);
        setSpecialtyPhase("refining");
      } else {
        // refining → step 5
        setStep(5);
      }
    } else if (step === 5) {
      // Compute scores and navigate to results
      if (jobs) {
        const scored = scoreJobs(
          jobs,
          rankedRegions,
          globalHospitals,
          rankedSpecialties,
          weights,
          lockRegions
        );
        const json = JSON.stringify(scored);
        sessionStorage.setItem("fy_scored_jobs", json);
        localStorage.setItem("fy_scored_jobs", json);
        router.push("/results");
      }
    }
  }

  function handleBack() {
    if (step === 4 && specialtyPhase === "refining") {
      // Back from ELO → return to DnD view, preserving state
      setSpecialtyPhase("ranking");
    } else if (step === 4 && specialtyPhase === "ranking") {
      setSpecialtyPhase("explainer");
    } else if (step === 2 && regionSubStep > 0) {
      setSortMode("default");
      setSearchOpen(false);
      setSearchQuery("");
      setRegionSubStep((s) => s - 1);
    } else if (step === 2) {
      setStep(1);
    } else {
      setStep((s) => s - 1);
    }
  }

  // Current region hospital count (for step 2 description)
  const currentRegion = rankedRegions[regionSubStep];
  const currentHospitals = currentRegion
    ? hospitalsByRegion[currentRegion.id] || []
    : [];

  function getDescription(): string {
    switch (step) {
      case 1:
        return "Drag to reorder by preference.";
      case 2:
        return `${regionSubStep + 1}/${rankedRegions.length} · ${currentHospitals.length} hospital${currentHospitals.length !== 1 ? "s" : ""}`;
      case 3:
        return lockRegions
          ? "Regions locked — hospitals stay within their region."
          : `${globalHospitals.length} hospitals across all regions.`;
      case 4:
        if (specialtyPhase === "refining")
          return "Pick your preference to sharpen your ranking.";
        if (specialtyPhase === "ranking")
          return "Drag to reorder by preference.";
        return "How specialty ranking works.";
      case 5:
        return lockRegions
          ? "Region order fixed. Adjust hospital and specialty weight."
          : "Adjust how much each factor matters.";
      default:
        return "";
    }
  }

  const weightTotal = weights.region + weights.hospital + weights.specialty;

  // Helper to get region color style
  function getRegionStyle(region: string) {
    return REGION_COLORS[region] ?? {
      bg: "bg-slate-950/40",
      border: "border-slate-800",
      text: "text-slate-300",
    };
  }

  if (loading) {
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

  return (
    <div className="flex h-dvh flex-col bg-background overflow-hidden">
      <SiteHeader />

      <main className="flex-1 flex flex-col items-center min-h-0 px-2 py-2 sm:px-4 sm:py-3">
        <div className="w-full max-w-2xl flex flex-col min-h-0 flex-1 gap-2">
          {/* Progress indicator — full width */}
          <div className="px-1 shrink-0">
            <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />
          </div>

        <Card className="shadow-lg min-h-0 flex-1 gap-0 py-0">
          <CardHeader className="shrink-0 py-4 sm:py-5">
            <div className="flex items-center gap-3">
              {(() => {
                const StepIcon = STEPS[step - 1]?.icon;
                return StepIcon ? (
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                    <StepIcon className="h-4.5 w-4.5 text-primary" />
                  </div>
                ) : null;
              })()}
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Step {step} of {TOTAL_STEPS}
                </p>
                <CardTitle className="text-lg">
                  {STEPS[step - 1]?.title}
                </CardTitle>
              </div>
              {step === 2 && currentRegion && (() => {
                const style = getRegionStyle(currentRegion.id);
                return (
                  <div className={cn(
                    "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
                    style.bg, style.border, style.text
                  )}>
                    <MapPin className="h-3 w-3" />
                    {currentRegion.label}
                  </div>
                );
              })()}
              {step === 4 && specialtyPhase === "refining" && eloState && (() => {
                const pct = Math.round(getConfidence(eloState, movedSpecialtyIds?.size) * 100);
                return (
                  <div className="ml-auto flex items-center gap-2">
                    <svg className="h-9 w-9" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor"
                        className="text-muted" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor"
                        className="text-primary transition-all duration-500"
                        strokeWidth="3"
                        strokeDasharray={`${pct * 94.25 / 100} 94.25`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)" />
                    </svg>
                    <span className="text-xs font-medium text-foreground">{pct}% ranked</span>
                  </div>
                );
              })()}
            </div>
            {/* Description + inline toolbar */}
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <CardDescription className="flex-1">
                  {getDescription()}
                </CardDescription>
                {/* Search + sort controls for list steps */}
                {(step === 2 || step === 3 || (step === 4 && specialtyPhase === "ranking")) && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {searchOpen ? (
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus
                          className="w-36 rounded-md border bg-background pl-7 pr-6 py-1 text-xs outline-none focus:ring-1 focus:ring-ring/50 placeholder:text-muted-foreground"
                        />
                        <button
                          onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSearchOpen(true)}
                        className="flex items-center justify-center h-7 w-7 rounded-md border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                        title="Search"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {step === 2 && (
                      <HospitalSortDropdown
                        items={currentHospitals}
                        onSort={(sortedItems) => {
                          setHospitalsByRegion((prev) => ({
                            ...prev,
                            [currentRegion!.id]: sortedItems,
                          }));
                        }}
                        userLocation={userLocation}
                        onLocationChange={setUserLocation}
                        hospitals={hospitals}
                        sortMode={sortMode}
                        onSortModeChange={setSortMode}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className={cn("flex-1 min-h-0 flex flex-col pb-0", step === 4 && specialtyPhase === "refining" ? "overflow-x-clip overflow-y-visible" : "overflow-hidden")}>
            {/* Step 1: Rank Regions with region colors */}
            {step === 1 && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                <SortableList
                  items={rankedRegions.map((r) => {
                    const style = getRegionStyle(r.id);
                    return { ...r, regionStyle: style };
                  })}
                  onReorder={(items) =>
                    setRankedRegions(items.map(({ id, label }) => ({ id, label })))
                  }
                />
              </div>
            )}

            {/* Step 2: Rank Hospitals per Region (can be large — use RankableList) */}
            {step === 2 && currentRegion && (
              <div className="flex flex-col flex-1 min-h-0">
                <RankableList
                  items={currentHospitals}
                  onReorder={(newItems) => {
                    setHospitalsByRegion((prev) => ({
                      ...prev,
                      [currentRegion.id]: newItems,
                    }));
                  }}
                  searchFilter={searchQuery}
                />
              </div>
            )}

            {/* Step 3: Global Hospital Ranking (large — use RankableList) */}
            {step === 3 && (
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
            )}

            {/* Step 4: Rank Specialties — explainer / DnD / ELO refinement */}
            {step === 4 && specialtyPhase === "explainer" && (
              <SpecialtyExplainer specialtyCount={rankedSpecialties.length} />
            )}
            {step === 4 && specialtyPhase === "ranking" && (
              <div className="flex flex-col flex-1 min-h-0">
                <RankableList
                  items={rankedSpecialties}
                  onReorder={setRankedSpecialties}
                  onItemMoved={(id) =>
                    setMovedSpecialtyIds((prev) => new Set(prev).add(id))
                  }
                  searchFilter={searchQuery}
                />
              </div>
            )}
            {step === 4 && specialtyPhase === "refining" && (
              <SpecialtyDuel
                specialties={rankedSpecialties.map((s) => s.label)}
                eloState={eloState}
                onStateChange={setEloState}
                onRankingChange={setRankedSpecialties}
                movedIds={movedSpecialtyIds}
              />
            )}

            {/* Step 5: Set Weights */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="space-y-5">
                  {/* Region weight — hidden when regions are locked */}
                  {!lockRegions && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          Region
                        </label>
                        <span className="text-xs font-mono text-muted-foreground tabular-nums">
                          {(weights.region * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[weights.region]}
                        onValueChange={([v]) =>
                          setWeights((w) => ({ ...w, region: v }))
                        }
                        max={1}
                        step={0.01}
                      />
                    </div>
                  )}

                  {/* Hospital weight */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        Hospital
                      </label>
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">
                        {(weights.hospital * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[weights.hospital]}
                      onValueChange={([v]) =>
                        setWeights((w) => ({ ...w, hospital: v }))
                      }
                      max={1}
                      step={0.01}
                    />
                  </div>

                  {/* Specialty weight */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Stethoscope className="h-3.5 w-3.5 text-primary" />
                        Specialty
                      </label>
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">
                        {(weights.specialty * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[weights.specialty]}
                      onValueChange={([v]) =>
                        setWeights((w) => ({ ...w, specialty: v }))
                      }
                      max={1}
                      step={0.01}
                    />
                  </div>
                </div>

                {/* Weight distribution visual */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Effective distribution
                  </p>
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    {!lockRegions && (
                      <div
                        className="bg-blue-400 transition-all"
                        style={{
                          width: `${(weights.region / weightTotal) * 100}%`,
                        }}
                      />
                    )}
                    <div
                      className="bg-amber-400 transition-all"
                      style={{
                        width: lockRegions
                          ? `${(weights.hospital / (weights.hospital + weights.specialty)) * 100}%`
                          : `${(weights.hospital / weightTotal) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-emerald-400 transition-all"
                      style={{
                        width: lockRegions
                          ? `${(weights.specialty / (weights.hospital + weights.specialty)) * 100}%`
                          : `${(weights.specialty / weightTotal) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    {!lockRegions && (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />
                        Region {((weights.region / weightTotal) * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Hospital{" "}
                      {lockRegions
                        ? ((weights.hospital / (weights.hospital + weights.specialty)) * 100).toFixed(0)
                        : ((weights.hospital / weightTotal) * 100).toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Specialty{" "}
                      {lockRegions
                        ? ((weights.specialty / (weights.hospital + weights.specialty)) * 100).toFixed(0)
                        : ((weights.specialty / weightTotal) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {/* Nav buttons inside card */}
          <div className="shrink-0 border-t px-4 py-2 sm:px-6 sm:py-3 flex items-center justify-between">
            {step > 1 || (step === 4 && specialtyPhase !== "explainer") ? (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleNext}
                className="min-w-25"
              >
                {step === TOTAL_STEPS
                  ? "Calculate & View Results"
                  : step === 4 && specialtyPhase === "explainer"
                    ? "Start Ranking"
                    : step === 4 && specialtyPhase === "ranking"
                      ? "Continue to Refinement"
                      : "Continue"}
              </Button>
            </div>
          </div>

        </Card>
        </div>
      </main>

      <SiteFooter className="hidden sm:block" />
    </div>
  );
}
