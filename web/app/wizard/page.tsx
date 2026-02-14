"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { ProximitySorter } from "@/components/proximity-sorter";
import type { Hospital, UserLocation } from "@/lib/proximity";
import {
  MapPin,
  Building2,
  Globe,
  Stethoscope,
  SlidersHorizontal,
} from "lucide-react";

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
  // Step 4: Rank Specialties
  const [rankedSpecialties, setRankedSpecialties] = useState<SortableItem[]>(
    []
  );
  // Proximity sorting
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
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
    if (step === 1) {
      setRegionSubStep(0);
      setStep(2);
    } else if (step === 2) {
      if (regionSubStep < rankedRegions.length - 1) {
        setRegionSubStep((s) => s + 1);
      } else {
        setGlobalHospitals(deriveGlobalHospitals());
        setStep(3);
      }
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
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
        sessionStorage.setItem("fy_scored_jobs", JSON.stringify(scored));
        router.push("/results");
      }
    }
  }

  function handleBack() {
    if (step === 2 && regionSubStep > 0) {
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
        return "Drag to rank the regions from most to least preferred. You can always come back and adjust.";
      case 2:
        return `Rank hospitals in ${currentRegion?.label ?? "region"} (${regionSubStep + 1} of ${rankedRegions.length}) · ${currentHospitals.length} hospital${currentHospitals.length !== 1 ? "s" : ""}`;
      case 3:
        return lockRegions
          ? "Regions are kept separate — hospitals follow your region and per-region rankings with no cross-region mixing."
          : `Fine-tune the overall hospital order across all regions. ${globalHospitals.length} hospitals total — use search and keyboard repositioning for speed.`;
      case 4:
        return `Rank specialties from most to least preferred. ${rankedSpecialties.length} specialties found.`;
      case 5:
        return lockRegions
          ? "Region order is fixed. Adjust how much hospital and specialty preferences influence your score within each region."
          : "How much should each factor influence your score? Adjust the sliders — the scores will be computed when you continue.";
      default:
        return "";
    }
  }

  const weightTotal = weights.region + weights.hospital + weights.specialty;

  // Helper to get region color style
  function getRegionStyle(region: string) {
    return REGION_COLORS[region] ?? {
      bg: "bg-slate-50 dark:bg-slate-950/40",
      border: "border-slate-200 dark:border-slate-800",
      text: "text-slate-700 dark:text-slate-300",
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
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
        <h1 className="mx-auto w-full text-center text-2xl font-bold">Let the wizard guide you 🧙</h1>
          {/* Progress indicator — full width */}
          <div className="px-1">
            <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />
          </div>

        <Card className="shadow-lg">
          <CardHeader>
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
            </div>
            <CardDescription className="mt-2">
              {getDescription()}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Step 1: Rank Regions with region colors */}
            {step === 1 && (
              <SortableList
                items={rankedRegions.map((r) => {
                  const style = getRegionStyle(r.id);
                  return { ...r, regionStyle: style };
                })}
                onReorder={(items) =>
                  setRankedRegions(items.map(({ id, label }) => ({ id, label })))
                }
              />
            )}

            {/* Step 2: Rank Hospitals per Region (can be large — use RankableList) */}
            {step === 2 && currentRegion && (
              <div className="space-y-3">
                <ProximitySorter
                  items={currentHospitals}
                  onSort={(sortedItems) => {
                    setHospitalsByRegion((prev) => ({
                      ...prev,
                      [currentRegion.id]: sortedItems,
                    }));
                  }}
                  userLocation={userLocation}
                  onLocationChange={setUserLocation}
                  hospitals={hospitals}
                />
                <div className="h-[50vh]">
                  <RankableList
                    items={currentHospitals}
                    onReorder={(newItems) => {
                      setHospitalsByRegion((prev) => ({
                        ...prev,
                        [currentRegion.id]: newItems,
                      }));
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Global Hospital Ranking (large — use RankableList) */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
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
                  <div className="h-[48vh]">
                    <RankableList
                      items={globalHospitals}
                      onReorder={setGlobalHospitals}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Rank Specialties */}
            {step === 4 && (
              <div className="h-[55vh]">
                <RankableList
                  items={rankedSpecialties}
                  onReorder={setRankedSpecialties}
                />
              </div>
            )}

            {/* Step 5: Set Weights */}
            {step === 5 && (
              <div className="space-y-6">
                <p className="text-xs text-muted-foreground">
                  These weights control how much each factor contributes to
                  your final score. They don&apos;t need to add up to 1 — we normalise
                  them for you.
                </p>

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

          <CardFooter className="justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <div />
            )}
            <Button
              onClick={handleNext}
              className="min-w-25"
            >
              {step === TOTAL_STEPS ? "Calculate & View Results" : "Continue"}
            </Button>
          </CardFooter>
        </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
