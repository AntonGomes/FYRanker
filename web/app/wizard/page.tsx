"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PickRankPanel, type PickRankItem } from "@/components/pick-rank-panel";
import { ExplainerCard } from "@/components/explainer-card";
import { DuelTransition } from "@/components/duel-transition";
import { SpecialtyDuel } from "@/components/specialty-duel";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { REGION_COLORS } from "@/components/job-detail-panel";
import type { Job } from "@/lib/parse-xlsx";
import { loadJobs } from "@/lib/parse-csv";
import { extractUniqueValues } from "@/lib/extract";
import { scoreJobs } from "@/lib/scoring";
import type { SortableItem } from "@/components/sortable-list";
import type { Hospital, UserLocation } from "@/lib/proximity";
import {
  geocodeLocation,
  sortHospitalsByProximity,
} from "@/lib/proximity";
import {
  type EloState,
  initEloFromRanking,
  getConfidence,
} from "@/lib/elo";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Building2,
  Stethoscope,
  SlidersHorizontal,
  Navigation,
  Loader2,
} from "lucide-react";

/* ── Step definitions ── */

const STEPS = [
  {
    title: "Rank Regions",
    icon: MapPin,
    description: "Pick which regions you prefer",
  },
  {
    title: "Rank Sites",
    icon: Building2,
    description: "Order sites within each region",
  },
  {
    title: "Rank Specialties",
    icon: Stethoscope,
    description: "Order specialties, then refine with duels",
  },
  {
    title: "Set Weights",
    icon: SlidersHorizontal,
    description: "Decide what matters most",
  },
];

const TOTAL_STEPS = STEPS.length;

type SpecialtyPhase = "ranking" | "transitioning" | "refining";

/* ── Progress bar ── */

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

/* ── Proximity action card ── */

function ProximityAction({
  userLocation,
  onLocationChange,
  hospitals,
  items,
  onSort,
}: {
  userLocation: UserLocation | null;
  onLocationChange: (loc: UserLocation | null) => void;
  hospitals: Hospital[];
  items: PickRankItem[];
  onSort: (sorted: PickRankItem[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [postcode, setPostcode] = useState("");

  const handleAutoDetect = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc: UserLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          displayName: `${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)}`,
        };
        onLocationChange(loc);
        onSort(sortHospitalsByProximity(items, loc, hospitals));
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Access denied — enter a postcode instead"
            : "Could not get location"
        );
        setLoading(false);
        setShowInput(true);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, [hospitals, items, onLocationChange, onSort]);

  const handlePostcode = useCallback(async () => {
    const q = postcode.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const loc = await geocodeLocation(q);
      if (loc) {
        onLocationChange(loc);
        onSort(sortHospitalsByProximity(items, loc, hospitals));
        setShowInput(false);
      } else {
        setError("Not found — try another postcode");
      }
    } catch {
      setError("Lookup failed");
    } finally {
      setLoading(false);
    }
  }, [postcode, hospitals, items, onLocationChange, onSort]);

  // If we already have a location, show compact version
  if (userLocation) {
    return (
      <button
        onClick={() => onSort(sortHospitalsByProximity(items, userLocation, hospitals))}
        className="w-full flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-left hover:bg-primary/10 transition-colors"
      >
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Sort by distance</p>
          <p className="text-[11px] text-muted-foreground truncate">
            from {userLocation.displayName}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLocationChange(null);
            setShowInput(true);
          }}
          className="text-[10px] text-muted-foreground hover:text-foreground underline shrink-0"
        >
          change
        </button>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {!showInput ? (
        <button
          onClick={handleAutoDetect}
          disabled={loading}
          className="w-full flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-left hover:bg-accent/40 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4 text-primary shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">
              {loading ? "Locating..." : "Sort by distance"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Auto-rank sites nearest to you
            </p>
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="e.g. EH1 1YZ"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePostcode();
            }}
            className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring/50 placeholder:text-muted-foreground"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handlePostcode}
            disabled={loading || !postcode.trim()}
            className="h-7 text-xs"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Go"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setShowInput(false); setError(null); }}
            className="h-7 text-xs"
          >
            <Navigation className="h-3 w-3" />
          </Button>
        </div>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

/* ── Main Page ── */

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);

  // All extracted data (source of truth for "all items")
  const [allRegions, setAllRegions] = useState<PickRankItem[]>([]);
  const [allSitesByRegion, setAllSitesByRegion] = useState<
    Record<string, PickRankItem[]>
  >({});
  const [allSpecialties, setAllSpecialties] = useState<PickRankItem[]>([]);

  // Ranked items (user selections)
  const [rankedRegions, setRankedRegions] = useState<PickRankItem[]>([]);
  const [rankedSitesByRegion, setRankedSitesByRegion] = useState<
    Record<string, PickRankItem[]>
  >({});
  const [regionSubStep, setRegionSubStep] = useState(0);
  const [rankedSpecialties, setRankedSpecialties] = useState<PickRankItem[]>(
    []
  );

  // Global site ranking (optional)
  const [showGlobalSiteRanking, setShowGlobalSiteRanking] = useState(false);
  const [globalSiteOrder, setGlobalSiteOrder] = useState<PickRankItem[]>([]);

  // Specialty phases
  const [specialtyPhase, setSpecialtyPhase] =
    useState<SpecialtyPhase>("ranking");
  const [lockedSpecialtyIds, setLockedSpecialtyIds] = useState<Set<string>>(
    new Set()
  );
  const [eloState, setEloState] = useState<EloState | null>(null);
  const [duelTransitioning, setDuelTransitioning] = useState(false);

  // Proximity
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  // Weights
  const [weights, setWeights] = useState({
    region: 0.33,
    hospital: 0.33,
    specialty: 0.33,
  });

  // Load data
  useEffect(() => {
    Promise.all([
      loadJobs(),
      fetch("/hospitals.json").then((r) => r.json() as Promise<Hospital[]>),
    ]).then(([parsed, hospitalData]) => {
      setJobs(parsed);
      setHospitals(hospitalData);

      const data = extractUniqueValues(parsed);
      const regionItems = data.regions.map((r) => ({ id: r, label: r }));
      setAllRegions(regionItems);

      const byRegion: Record<string, PickRankItem[]> = {};
      for (const [region, sites] of Object.entries(data.hospitalsByRegion)) {
        byRegion[region] = sites.map((s) => ({ id: s, label: s }));
      }
      setAllSitesByRegion(byRegion);

      const specItems = data.specialties.map((s) => ({ id: s, label: s }));
      setAllSpecialties(specItems);

      setLoading(false);
    });
  }, []);

  // Derive global hospitals from region + per-region rankings
  function deriveGlobalHospitals(): PickRankItem[] {
    const result: PickRankItem[] = [];
    for (const region of rankedRegions) {
      const sites = rankedSitesByRegion[region.id] || [];
      // Also include unranked sites for the region
      const allSites = allSitesByRegion[region.id] || [];
      const rankedIds = new Set(sites.map((s) => s.id));
      const unranked = allSites.filter((s) => !rankedIds.has(s.id));
      for (const site of [...sites, ...unranked]) {
        result.push({
          id: `${site.id}__${region.id}`,
          label: site.label,
          badge: region.label,
        });
      }
    }
    // Also include unranked regions' sites
    const rankedRegionIds = new Set(rankedRegions.map((r) => r.id));
    for (const region of allRegions) {
      if (rankedRegionIds.has(region.id)) continue;
      const sites = allSitesByRegion[region.id] || [];
      for (const site of sites) {
        result.push({
          id: `${site.id}__${region.id}`,
          label: site.label,
          badge: region.label,
        });
      }
    }
    return result;
  }

  // Current region for step 2
  const currentRegionIndex = regionSubStep;
  // Show regions in ranked order first, then unranked
  const orderedRegions = useMemo(() => {
    const rankedIds = new Set(rankedRegions.map((r) => r.id));
    const unranked = allRegions.filter((r) => !rankedIds.has(r.id));
    return [...rankedRegions, ...unranked];
  }, [rankedRegions, allRegions]);

  const currentRegion = orderedRegions[currentRegionIndex];
  const currentRegionSites = currentRegion
    ? allSitesByRegion[currentRegion.id] || []
    : [];
  const currentRankedSites = currentRegion
    ? rankedSitesByRegion[currentRegion.id] || []
    : [];

  // After completing all region substeps in step 2, are we at the global toggle?
  const allRegionSubStepsDone =
    regionSubStep >= orderedRegions.length;

  // Unranked warning state
  const [showUnrankedWarning, setShowUnrankedWarning] = useState(false);
  const [pendingAdvance, setPendingAdvance] = useState<(() => void) | null>(
    null
  );

  // Helper: append unranked items in default order
  function ensureAllRanked<T extends PickRankItem>(
    ranked: T[],
    all: T[]
  ): T[] {
    const rankedIds = new Set(ranked.map((i) => i.id));
    const unranked = all.filter((i) => !rankedIds.has(i.id));
    return [...ranked, ...unranked];
  }

  // Check if there are unranked items for current step
  function hasUnrankedItems(): boolean {
    if (step === 1) {
      return rankedRegions.length < allRegions.length;
    }
    if (step === 2 && !allRegionSubStepsDone) {
      return currentRankedSites.length < currentRegionSites.length;
    }
    if (step === 3) {
      return rankedSpecialties.length < allSpecialties.length;
    }
    return false;
  }

  function getUnrankedCount(): number {
    if (step === 1) return allRegions.length - rankedRegions.length;
    if (step === 2 && !allRegionSubStepsDone)
      return currentRegionSites.length - currentRankedSites.length;
    if (step === 3) return allSpecialties.length - rankedSpecialties.length;
    return 0;
  }

  // Navigation
  function doAdvance() {
    if (step === 1) {
      // Auto-fill unranked regions
      setRankedRegions(ensureAllRanked(rankedRegions, allRegions));
      setRegionSubStep(0);
      setStep(2);
    } else if (step === 2) {
      if (!allRegionSubStepsDone) {
        // Save current region's sites with unranked appended
        if (currentRegion) {
          setRankedSitesByRegion((prev) => ({
            ...prev,
            [currentRegion.id]: ensureAllRanked(
              currentRankedSites,
              currentRegionSites
            ),
          }));
        }
        setRegionSubStep((s) => s + 1);
      } else {
        // Done with all regions (including optional global), advance to step 3
        setStep(3);
        setSpecialtyPhase("ranking");
      }
    } else if (step === 3) {
      if (specialtyPhase === "ranking") {
        // Start duel transition
        setRankedSpecialties(
          ensureAllRanked(rankedSpecialties, allSpecialties)
        );
        setDuelTransitioning(true);
        setSpecialtyPhase("transitioning");
      } else if (specialtyPhase === "refining") {
        setStep(4);
      }
    } else if (step === 4) {
      // Compute scores and navigate to results
      if (jobs) {
        // Build global hospitals list
        const globalHospitals = showGlobalSiteRanking && globalSiteOrder.length > 0
          ? globalSiteOrder
          : deriveGlobalHospitals();

        // Ensure all specialties are in the ranked list
        const finalSpecialties = ensureAllRanked(
          rankedSpecialties,
          allSpecialties
        );

        // Ensure all regions ranked
        const finalRegions = ensureAllRanked(rankedRegions, allRegions);

        const scored = scoreJobs(
          jobs,
          finalRegions as SortableItem[],
          globalHospitals as SortableItem[],
          finalSpecialties as SortableItem[],
          weights,
          false
        );
        const json = JSON.stringify(scored);
        sessionStorage.setItem("fy_scored_jobs", json);
        localStorage.setItem("fy_scored_jobs", json);
        router.push("/results");
      }
    }
  }

  function handleNext() {
    // Check for unranked items (skip for weights step, duel phase, global toggle)
    if (
      step <= 3 &&
      !(step === 2 && allRegionSubStepsDone) &&
      !(step === 3 && specialtyPhase !== "ranking") &&
      hasUnrankedItems()
    ) {
      const count = getUnrankedCount();
      setPendingAdvance(() => () => doAdvance());
      setShowUnrankedWarning(true);
      return;
    }
    doAdvance();
  }

  function handleSkipDuel() {
    // Skip duel, go directly to weights
    setRankedSpecialties(ensureAllRanked(rankedSpecialties, allSpecialties));
    setStep(4);
  }

  function handleBack() {
    if (step === 3 && specialtyPhase === "refining") {
      setSpecialtyPhase("ranking");
    } else if (step === 2 && allRegionSubStepsDone) {
      // Back from global toggle to last region
      setRegionSubStep(orderedRegions.length - 1);
    } else if (step === 2 && regionSubStep > 0) {
      setRegionSubStep((s) => s - 1);
    } else if (step === 2) {
      setStep(1);
    } else {
      setStep((s) => s - 1);
    }
  }

  // Duel transition complete
  const handleDuelTransitionComplete = useCallback(() => {
    const finalSpecialties = ensureAllRanked(rankedSpecialties, allSpecialties);
    // Seed ELO from ranking
    const movedIds = new Set(rankedSpecialties.map((s) => s.id));
    const seeded = initEloFromRanking(
      finalSpecialties as SortableItem[],
      movedIds
    );
    setEloState(seeded);
    setDuelTransitioning(false);
    setSpecialtyPhase("refining");
  }, [rankedSpecialties, allSpecialties]);

  // Description text
  function getDescription(): string {
    switch (step) {
      case 1:
        return "Click regions to rank them by preference.";
      case 2:
        if (allRegionSubStepsDone) {
          return "Optionally fine-tune the global site order across all regions.";
        }
        return `Region ${regionSubStep + 1} of ${orderedRegions.length} — pick and rank sites by preference.`;
      case 3:
        if (specialtyPhase === "refining")
          return "Pick your preference to sharpen your ranking.";
        return "Pick specialties in your preferred order. Lock items to protect them from duels.";
      case 4:
        return "Decide how much each factor influences your final ranking.";
      default:
        return "";
    }
  }

  // Button text
  function getNextButtonText(): string {
    if (step === TOTAL_STEPS) return "Calculate & View Results";
    if (step === 3 && specialtyPhase === "ranking") return "Continue to Duel";
    if (step === 3 && specialtyPhase === "refining") return "Done";
    if (step === 2 && !allRegionSubStepsDone) return "Next Region";
    if (step === 2 && allRegionSubStepsDone) return "Continue";
    return "Continue";
  }

  const weightTotal = weights.region + weights.hospital + weights.specialty;

  function getRegionStyle(region: string) {
    return (
      REGION_COLORS[region] ?? {
        bg: "bg-slate-950/40",
        border: "border-slate-800",
        text: "text-slate-300",
      }
    );
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
        <div className="w-full max-w-3xl flex flex-col min-h-0 flex-1 gap-2">
          {/* Progress indicator */}
          <div className="px-1 shrink-0">
            <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />
          </div>

          <Card className="shadow-lg min-h-0 flex-1 gap-0 py-0 relative">
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
                {step === 2 && currentRegion && !allRegionSubStepsDone &&
                  (() => {
                    const style = getRegionStyle(currentRegion.id);
                    return (
                      <div
                        className={cn(
                          "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
                          style.bg,
                          style.border,
                          style.text
                        )}
                      >
                        <MapPin className="h-3 w-3" />
                        {currentRegion.label}
                      </div>
                    );
                  })()}
                {step === 3 && specialtyPhase === "refining" && eloState &&
                  (() => {
                    const movedIds = new Set(rankedSpecialties.map((s) => s.id));
                    const pct = Math.round(
                      getConfidence(eloState, movedIds.size) * 100
                    );
                    return (
                      <div className="ml-auto flex items-center gap-2">
                        <svg className="h-9 w-9" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            fill="none"
                            stroke="currentColor"
                            className="text-muted"
                            strokeWidth="3"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            fill="none"
                            stroke="currentColor"
                            className="text-primary transition-all duration-500"
                            strokeWidth="3"
                            strokeDasharray={`${(pct * 94.25) / 100} 94.25`}
                            strokeLinecap="round"
                            transform="rotate(-90 18 18)"
                          />
                        </svg>
                        <span className="text-xs font-medium text-foreground">
                          {pct}% ranked
                        </span>
                      </div>
                    );
                  })()}
              </div>
              <CardDescription className="mt-2">
                {getDescription()}
              </CardDescription>
            </CardHeader>

            <CardContent
              className={cn(
                "flex-1 min-h-0 flex flex-col pb-0",
                step === 3 && specialtyPhase === "refining"
                  ? "overflow-x-clip overflow-y-visible"
                  : "overflow-hidden"
              )}
            >
              {/* Step 1: Rank Regions */}
              {step === 1 && (
                <div className="flex flex-col flex-1 min-h-0 gap-3">
                  <ExplainerCard title="How does this work?">
                    Click regions to add them to your ranking. The order you
                    click is the order they&apos;ll be ranked. Drag to reorder
                    after adding.
                  </ExplainerCard>
                  <PickRankPanel
                    allItems={allRegions}
                    rankedItems={rankedRegions}
                    onRankedChange={setRankedRegions}
                    emptyMessage="Click regions to start ranking"
                  />
                </div>
              )}

              {/* Step 2: Rank Sites per region */}
              {step === 2 && !allRegionSubStepsDone && currentRegion && (
                <div className="flex flex-col flex-1 min-h-0">
                  <PickRankPanel
                    key={currentRegion.id}
                    allItems={currentRegionSites}
                    rankedItems={currentRankedSites}
                    onRankedChange={(items) => {
                      setRankedSitesByRegion((prev) => ({
                        ...prev,
                        [currentRegion.id]: items,
                      }));
                    }}
                    emptyMessage="Click sites to start ranking"
                    availableHeader={
                      <ProximityAction
                        userLocation={userLocation}
                        onLocationChange={setUserLocation}
                        hospitals={hospitals}
                        items={currentRegionSites}
                        onSort={(sorted) => {
                          setRankedSitesByRegion((prev) => ({
                            ...prev,
                            [currentRegion.id]: sorted,
                          }));
                        }}
                      />
                    }
                  />
                </div>
              )}

              {/* Step 2: Global site ranking toggle (after all region substeps) */}
              {step === 2 && allRegionSubStepsDone && (
                <div className="flex flex-col flex-1 min-h-0 gap-3">
                  <div className="flex items-center gap-3 rounded-lg border px-4 py-3 shrink-0">
                    <Switch
                      id="global-site-toggle"
                      checked={showGlobalSiteRanking}
                      onCheckedChange={(checked) => {
                        setShowGlobalSiteRanking(checked);
                        if (checked && globalSiteOrder.length === 0) {
                          setGlobalSiteOrder(deriveGlobalHospitals());
                        }
                      }}
                    />
                    <Label
                      htmlFor="global-site-toggle"
                      className="cursor-pointer leading-snug"
                    >
                      <span className="font-medium">
                        Fine-tune global site order
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Reorder all sites across regions — most users skip this
                      </span>
                    </Label>
                  </div>

                  {showGlobalSiteRanking && globalSiteOrder.length > 0 && (
                    <PickRankPanel
                      allItems={deriveGlobalHospitals()}
                      rankedItems={globalSiteOrder}
                      onRankedChange={setGlobalSiteOrder}
                      emptyMessage="Click sites to reorder globally"
                    />
                  )}
                </div>
              )}

              {/* Step 3: Rank Specialties — pick-then-rank phase */}
              {step === 3 && specialtyPhase === "ranking" && (
                <div className="flex flex-col flex-1 min-h-0 gap-3">
                  <ExplainerCard title="How does this work?">
                    Pick specialties to build your ranking. Lock items to
                    protect them from the duel refinement phase. After ranking,
                    you&apos;ll compare pairs head-to-head to sharpen the order.
                  </ExplainerCard>
                  <PickRankPanel
                    allItems={allSpecialties}
                    rankedItems={rankedSpecialties}
                    onRankedChange={setRankedSpecialties}
                    allowLock
                    lockedIds={lockedSpecialtyIds}
                    onLockedChange={setLockedSpecialtyIds}
                    emptyMessage="Click specialties to start ranking"
                  />
                </div>
              )}

              {/* Step 3: Duel refinement */}
              {step === 3 && specialtyPhase === "refining" && (
                <SpecialtyDuel
                  specialties={ensureAllRanked(
                    rankedSpecialties,
                    allSpecialties
                  ).map((s) => s.label)}
                  eloState={eloState}
                  onStateChange={setEloState}
                  onRankingChange={(items) =>
                    setRankedSpecialties(items as PickRankItem[])
                  }
                  movedIds={
                    new Set(rankedSpecialties.map((s) => s.id))
                  }
                  lockedIds={lockedSpecialtyIds}
                />
              )}

              {/* Step 4: Set Weights */}
              {step === 4 && (
                <div className="space-y-6 pb-4">
                  <div className="space-y-5">
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

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          Site
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
                      <div
                        className="bg-blue-400 transition-all"
                        style={{
                          width: `${(weights.region / weightTotal) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-amber-400 transition-all"
                        style={{
                          width: `${(weights.hospital / weightTotal) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-emerald-400 transition-all"
                        style={{
                          width: `${(weights.specialty / weightTotal) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />
                        Region{" "}
                        {((weights.region / weightTotal) * 100).toFixed(0)}%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Site{" "}
                        {((weights.hospital / weightTotal) * 100).toFixed(0)}%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Specialty{" "}
                        {((weights.specialty / weightTotal) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    You&apos;re all set — hit the button below to see your
                    personalised ranking.
                  </p>
                </div>
              )}
            </CardContent>

            {/* Nav buttons */}
            <div className="shrink-0 border-t px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
              {step > 1 ||
              (step === 3 && specialtyPhase === "refining") ? (
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-3">
                {step === 3 && specialtyPhase === "ranking" && (
                  <Button variant="ghost" onClick={handleSkipDuel}>
                    Skip Duel
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  className="min-w-25"
                  disabled={
                    step === 3 &&
                    specialtyPhase === "ranking" &&
                    rankedSpecialties.length === 0
                  }
                >
                  {getNextButtonText()}
                </Button>
              </div>
            </div>

            {/* Duel transition overlay */}
            <DuelTransition
              active={duelTransitioning}
              totalSpecialties={allSpecialties.length}
              lockedCount={lockedSpecialtyIds.size}
              onComplete={handleDuelTransitionComplete}
            />
          </Card>
        </div>
      </main>

      <SiteFooter className="hidden sm:block" />

      {/* Unranked items warning dialog */}
      {showUnrankedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-xl border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">
              Unranked items
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {getUnrankedCount()} item
              {getUnrankedCount() !== 1 ? "s" : ""} will be added at the end in
              default order. Continue?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowUnrankedWarning(false);
                  setPendingAdvance(null);
                }}
              >
                Go back
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowUnrankedWarning(false);
                  pendingAdvance?.();
                  setPendingAdvance(null);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
