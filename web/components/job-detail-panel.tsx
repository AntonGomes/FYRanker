"use client";

import { useState } from "react";
import type { Job } from "@/lib/parse-xlsx";
import { getJobPlacements, type PlacementEntry } from "@/lib/parse-xlsx";
import { getRegionStyle, REGION_COLORS } from "@/lib/region-colors";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegionBadge } from "@/components/ui/region-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { PlacementDetailCard } from "@/components/placement-detail-card";

export { getRegionStyle, REGION_COLORS };

interface JobDetailPanelProps {
  job: Job;
  onClose: () => void;
  isMobile: boolean;
}

function PlacementCard({
  entry,
  isActive,
  onClick,
}: {
  entry: PlacementEntry;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-colors group flex items-center gap-3",
        isActive
          ? "ring-1 ring-primary/60 bg-primary/10 border-primary/30"
          : "bg-muted/30 hover:bg-muted/60"
      )}
    >
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
        {entry.num}
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-sm block truncate">{entry.spec}</span>
        <span className="italic font-semibold text-xs block truncate">{entry.site}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
    </button>
  );
}

function FYSection({
  label,
  entries,
  activePlacementNum,
  onSelectPlacement,
}: {
  label: string;
  entries: PlacementEntry[];
  activePlacementNum: number | null;
  onSelectPlacement: (entry: PlacementEntry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <SectionLabel className="mb-2">{label}</SectionLabel>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.num}>
            <PlacementCard entry={entry} isActive={activePlacementNum === entry.num} onClick={() => onSelectPlacement(entry)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelHeader({
  job,
  onClose,
}: {
  job: Job;
  onClose: () => void;
}) {
  const style = getRegionStyle(job.region);
  return (
    <div className={cn("px-5 py-4 border-b shrink-0", style.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight truncate">
            {job.programmeTitle}
          </h2>
          <RegionBadge region={job.region} className="inline-block mt-1.5 px-2.5 text-xs font-medium" />
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PlacementList({
  fy1,
  fy2,
  selectedPlacement,
  onSelectPlacement,
}: {
  fy1: PlacementEntry[];
  fy2: PlacementEntry[];
  selectedPlacement: PlacementEntry | null;
  onSelectPlacement: (entry: PlacementEntry) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-4 space-y-5">
      <FYSection label="FY1" entries={fy1} activePlacementNum={selectedPlacement?.num ?? null} onSelectPlacement={onSelectPlacement} />
      {fy1.length > 0 && fy2.length > 0 && <div className="border-t" />}
      <FYSection label="FY2" entries={fy2} activePlacementNum={selectedPlacement?.num ?? null} onSelectPlacement={onSelectPlacement} />
    </div>
  );
}

export function JobDetailPanel({ job, onClose, isMobile }: JobDetailPanelProps) {
  const { fy1, fy2 } = getJobPlacements(job);
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementEntry | null>(null);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-background/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className={cn(
          "fixed z-50 flex flex-col bg-card shadow-2xl",
          isMobile ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl" : "top-0 bottom-0 w-96 border-l"
        )}
        initial={isMobile ? { y: "100%" } : { x: "100%", right: 0 }}
        animate={isMobile ? { y: 0 } : { x: 0, right: selectedPlacement ? "24rem" : 0 }}
        exit={isMobile ? { y: "100%" } : { x: "100%", right: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <PanelHeader job={job} onClose={onClose} />
        <PlacementList fy1={fy1} fy2={fy2} selectedPlacement={selectedPlacement} onSelectPlacement={setSelectedPlacement} />
      </motion.div>
      {selectedPlacement && (
        <div className={cn(
          "fixed z-50 bg-card shadow-2xl pointer-events-none",
          isMobile ? "inset-x-0 bottom-0 top-[12vh] rounded-t-2xl" : "top-0 right-0 bottom-0 w-96 border-l"
        )} />
      )}
      <AnimatePresence mode="wait">
        {selectedPlacement && (
          <PlacementDetailCard
            key={selectedPlacement.num}
            entry={selectedPlacement}
            onBack={() => setSelectedPlacement(null)}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>
    </>
  );
}
