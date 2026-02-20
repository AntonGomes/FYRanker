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
import { getRegionStyle } from "@/lib/region-colors";
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
] as const;

const TOTAL_STEPS = STEPS.length;

const WEIGHT_FIELDS = [
  { key: "region" as const, label: "Region", icon: MapPin, color: "bg-blue-400" },
  { key: "hospital" as const, label: "Hospital", icon: Building2, color: "bg-amber-400" },
  { key: "specialty" as const, label: "Specialty", icon: Stethoscope, color: "bg-emerald-400" },
] as const;

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
function SearchToolbar({
  searchOpen,
  searchQuery,
  onSearchOpenChange,
  onSearchQueryChange,
  sortDropdown,
}: {
  searchOpen: boolean;
  searchQuery: string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  sortDropdown?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {searchOpen ? (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            autoFocus
            className="w-36 rounded-md border bg-background pl-7 pr-6 py-1 text-xs outline-none focus:ring-1 focus:ring-ring/50 placeholder:text-muted-foreground"
          />
          <button
            onClick={() => { onSearchQueryChange(""); onSearchOpenChange(false); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => onSearchOpenChange(true)}
          className="flex items-center justify-center h-7 w-7 rounded-md border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Search"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      )}
      {sortDropdown}
    </div>
  );
}
function ConfidenceRing({ percentage }: { percentage: number }) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <svg className="h-9 w-9" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor"
          className="text-muted" strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor"
          className="text-primary transition-all duration-500"
          strokeWidth="3"
          strokeDasharray={`${percentage * 94.25 / 100} 94.25`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)" />
      </svg>
      <span className="text-xs font-medium text-foreground">{percentage}% ranked</span>
    </div>
  );
}
function WeightSlider({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        max={1}
        step={0.01}
      />
    </div>
  );
}
function WeightDistribution({
  weights,
  lockRegions,
}: {
  weights: { region: number; hospital: number; specialty: number };
  lockRegions: boolean;
}) {
  const visibleFields = lockRegions
    ? WEIGHT_FIELDS.filter((f) => f.key !== "region")
    : WEIGHT_FIELDS;

  const total = visibleFields.reduce((sum, f) => sum + weights[f.key], 0);

  function pct(key: "region" | "hospital" | "specialty"): string {
    return ((weights[key] / total) * 100).toFixed(0);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Effective distribution</p>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        {visibleFields.map((f) => (
          <div
            key={f.key}
            className={cn(f.color, "transition-all")}
            style={{ width: `${pct(f.key)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {visibleFields.map((f) => (
          <span key={f.key} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", f.color)} />
            {f.label} {pct(f.key)}%
          </span>
        ))}
      </div>
    </div>
  );
}
export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [rankedRegions, setRankedRegions] = useState<SortableItem[]>([]);
  const [hospitalsByRegion, setHospitalsByRegion] = useState<
    Record<string, SortableItem[]>
  >({});
  const [regionSubStep, setRegionSubStep] = useState(0);
  const [globalHospitals, setGlobalHospitals] = useState<SortableItem[]>([]);
  const [lockRegions, setLockRegions] = useState(false);
  const [rankedSpecialties, setRankedSpecialties] = useState<SortableItem[]>([]);
  const [eloState, setEloState] = useState<EloState | null>(null);
  const [movedSpecialtyIds, setMovedSpecialtyIds] = useState<Set<string>>(
    new Set()
  );
  const [specialtyPhase, setSpecialtyPhase] = useState<SpecialtyPhase>("explainer");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [weights, setWeights] = useState({
    region: 0.33,
    hospital: 0.33,
    specialty: 0.33,
  });

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

  function deriveGlobalHospitals(): SortableItem[] {
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

  function resetSearch(): void {
    setSearchOpen(false);
    setSearchQuery("");
  }

  function handleNext(): void {
    resetSearch();

    switch (step) {
      case 1:
        setRegionSubStep(0);
        setStep(2);
        break;

      case 2:
        if (regionSubStep < rankedRegions.length - 1) {
          setSortMode("default");
          setRegionSubStep((s) => s + 1);
        } else {
          setGlobalHospitals(deriveGlobalHospitals());
          setStep(3);
        }
        break;

      case 3:
        setStep(4);
        break;

      case 4:
        if (specialtyPhase === "explainer") {
          setSpecialtyPhase("ranking");
        } else if (specialtyPhase === "ranking") {
          const seeded = initEloFromRanking(rankedSpecialties, movedSpecialtyIds);
          setEloState(seeded);
          setSpecialtyPhase("refining");
        } else {
          setStep(5);
        }
        break;

      case 5:
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
        break;
    }
  }

  function handleBack(): void {
    if (step === 4 && specialtyPhase === "refining") {
      setSpecialtyPhase("ranking");
      return;
    }
    if (step === 4 && specialtyPhase === "ranking") {
      setSpecialtyPhase("explainer");
      return;
    }
    if (step === 2 && regionSubStep > 0) {
      setSortMode("default");
      resetSearch();
      setRegionSubStep((s) => s - 1);
      return;
    }
    if (step === 2) {
      setStep(1);
      return;
    }
    setStep((s) => s - 1);
  }

  function getNextButtonLabel(): string {
    if (step === TOTAL_STEPS) return "Calculate & View Results";
    if (step === 4 && specialtyPhase === "explainer") return "Start Ranking";
    if (step === 4 && specialtyPhase === "ranking") return "Continue to Refinement";
    return "Continue";
  }

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
        if (specialtyPhase === "refining") return "Pick your preference to sharpen your ranking.";
        if (specialtyPhase === "ranking") return "Drag to reorder by preference.";
        return "How specialty ranking works.";
      case 5:
        return lockRegions
          ? "Region order fixed. Adjust hospital and specialty weight."
          : "Adjust how much each factor matters.";
      default:
        return "";
    }
  }

  const showSearchToolbar = step === 2 || step === 3 || (step === 4 && specialtyPhase === "ranking");
  const showBackButton = step > 1 || (step === 4 && specialtyPhase !== "explainer");

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

              {step === 4 && specialtyPhase === "refining" && eloState && (
                <ConfidenceRing
                  percentage={Math.round(getConfidence(eloState, movedSpecialtyIds?.size) * 100)}
                />
              )}
            </div>

            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <CardDescription className="flex-1">
                  {getDescription()}
                </CardDescription>
                {showSearchToolbar && (
                  <SearchToolbar
                    searchOpen={searchOpen}
                    searchQuery={searchQuery}
                    onSearchOpenChange={setSearchOpen}
                    onSearchQueryChange={setSearchQuery}
                    sortDropdown={step === 2 ? (
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
                    ) : undefined}
                  />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className={cn("flex-1 min-h-0 flex flex-col pb-0", step === 4 && specialtyPhase === "refining" ? "overflow-x-clip overflow-y-visible" : "overflow-hidden")}>
            {step === 1 && (
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
            )}

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

            {step === 5 && (
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
            )}
          </CardContent>

          <div className="shrink-0 border-t px-4 py-2 sm:px-6 sm:py-3 flex items-center justify-between">
            {showBackButton ? (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              <Button onClick={handleNext} className="min-w-25">
                {getNextButtonLabel()}
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
