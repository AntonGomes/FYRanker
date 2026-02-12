"use client";

import { useState, useCallback, useEffect } from "react";
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
import { parseXlsx, type Job } from "@/lib/parse-xlsx";
import { extractUniqueValues, type ExtractedData } from "@/lib/extract";
import { scoreJobs } from "@/lib/scoring";
import { REGION_COLORS } from "@/components/job-detail-panel";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileSpreadsheet,
  MapPin,
  Building2,
  Globe,
  Stethoscope,
  SlidersHorizontal,
  CheckCircle2,
} from "lucide-react";

const STEPS = [
  { title: "Upload Jobs", icon: Upload, description: "Import your programme data" },
  { title: "Rank Regions", icon: MapPin, description: "Order regions by preference" },
  { title: "Rank Hospitals", icon: Building2, description: "Order hospitals within each region" },
  { title: "Global Hospital Ranking", icon: Globe, description: "Fine-tune the overall hospital order" },
  { title: "Rank Specialties", icon: Stethoscope, description: "Order specialties by preference" },
  { title: "Set Weights", icon: SlidersHorizontal, description: "Decide what matters most to you" },
  { title: "Your Ranking", icon: CheckCircle2, description: "Review and finalise your choices" },
];

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
            i + 1 < currentStep
              ? "bg-primary"
              : i + 1 === currentStep
                ? "bg-primary"
                : "bg-muted"
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
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);

  // Step 2
  const [rankedRegions, setRankedRegions] = useState<SortableItem[]>([]);
  // Step 3
  const [hospitalsByRegion, setHospitalsByRegion] = useState<
    Record<string, SortableItem[]>
  >({});
  const [regionSubStep, setRegionSubStep] = useState(0);
  // Step 4
  const [globalHospitals, setGlobalHospitals] = useState<SortableItem[]>([]);
  // Step 5
  const [rankedSpecialties, setRankedSpecialties] = useState<SortableItem[]>(
    []
  );
  // Step 6
  const [weights, setWeights] = useState({
    region: 0.33,
    hospital: 0.33,
    specialty: 0.33,
  });

  // File handling
  const handleFile = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const parsed = parseXlsx(buffer);
    setJobs(parsed);
    setFileName(file.name);

    const data = extractUniqueValues(parsed);
    setExtracted(data);
    setRankedRegions(toItems(data.regions));
    const byRegion: Record<string, SortableItem[]> = {};
    for (const [region, hospitals] of Object.entries(data.hospitalsByRegion)) {
      byRegion[region] = toItems(hospitals);
    }
    setHospitalsByRegion(byRegion);
    setRankedSpecialties(toItems(data.specialties));
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith(".xlsx")) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

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
      setStep(2);
    } else if (step === 2) {
      setRegionSubStep(0);
      setStep(3);
    } else if (step === 3) {
      if (regionSubStep < rankedRegions.length - 1) {
        setRegionSubStep((s) => s + 1);
      } else {
        setGlobalHospitals(deriveGlobalHospitals());
        setStep(4);
      }
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      setStep(6);
    } else if (step === 6) {
      // Compute scores and navigate to results
      if (jobs) {
        const scored = scoreJobs(
          jobs,
          rankedRegions,
          globalHospitals,
          rankedSpecialties,
          weights
        );
        sessionStorage.setItem("fy_scored_jobs", JSON.stringify(scored));
        router.push("/results");
      }
    }
  }

  function handleBack() {
    if (step === 3 && regionSubStep > 0) {
      setRegionSubStep((s) => s - 1);
    } else if (step === 3) {
      setStep(2);
    } else {
      setStep((s) => s - 1);
    }
  }

  // Current region hospital count (for step 3 description)
  const currentRegion = rankedRegions[regionSubStep];
  const currentHospitals = currentRegion
    ? hospitalsByRegion[currentRegion.id] || []
    : [];

  function getDescription(): string {
    switch (step) {
      case 1:
        return "Upload your ORIEL .xlsx export to get started. We'll walk you through ranking everything step by step.";
      case 2:
        return "Drag to rank the regions from most to least preferred. You can always come back and adjust.";
      case 3:
        return `Rank hospitals in ${currentRegion?.label ?? "region"} (${regionSubStep + 1} of ${rankedRegions.length}) · ${currentHospitals.length} hospital${currentHospitals.length !== 1 ? "s" : ""}`;
      case 4:
        return `Now fine-tune the overall hospital order across all regions. ${globalHospitals.length} hospitals total — use search and keyboard repositioning for speed.`;
      case 5:
        return `Rank specialties from most to least preferred. ${rankedSpecialties.length} specialties found.`;
      case 6:
        return "How much should each factor influence your score? Adjust the sliders — the scores will be computed when you continue.";
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          {/* Progress indicator — full width */}
          <div className="px-1">
            <StepIndicator currentStep={step} totalSteps={6} />
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
                  Step {step} of 7
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
            {/* Step 1: Upload */}
            {step === 1 && (
              <div className="space-y-4">
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() =>
                    document.getElementById("file-input")?.click()
                  }
                  className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/30"
                  }`}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={onFileInput}
                  />
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">
                    Drop your .xlsx file here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse your files
                  </p>
                </div>
                {jobs && (
                  <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Ready to go!</p>
                      <p className="text-xs text-muted-foreground">
                        Loaded <strong>{fileName}</strong> —{" "}
                        {jobs.length} programmes across{" "}
                        {extracted?.regions.length ?? 0} regions
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Rank Regions with region colors */}
            {step === 2 && (
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

            {/* Step 3: Rank Hospitals per Region (can be large — use RankableList) */}
            {step === 3 && currentRegion && (
              <div className="h-[55vh]">
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
            )}

            {/* Step 4: Global Hospital Ranking (large — use RankableList) */}
            {step === 4 && (
              <div className="h-[55vh]">
                <RankableList
                  items={globalHospitals}
                  onReorder={setGlobalHospitals}
                />
              </div>
            )}

            {/* Step 5: Rank Specialties */}
            {step === 5 && (
              <div className="h-[55vh]">
                <RankableList
                  items={rankedSpecialties}
                  onReorder={setRankedSpecialties}
                />
              </div>
            )}

            {/* Step 6: Set Weights */}
            {step === 6 && (
              <div className="space-y-6">
                <p className="text-xs text-muted-foreground">
                  These weights control how much each factor contributes to
                  your final score. They don&apos;t need to add up to 1 — we normalise
                  them for you.
                </p>

                <div className="space-y-5">
                  {/* Region weight */}
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
                      Region {((weights.region / weightTotal) * 100).toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Hospital {((weights.hospital / weightTotal) * 100).toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Specialty {((weights.specialty / weightTotal) * 100).toFixed(0)}%
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
              disabled={step === 1 && !jobs}
              className="min-w-25"
            >
              {step === 6 ? "Calculate & View Results" : "Continue"}
            </Button>
          </CardFooter>
        </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
