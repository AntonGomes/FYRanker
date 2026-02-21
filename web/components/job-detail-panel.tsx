"use client";

import { useState, useCallback, useMemo } from "react";
import type { Job } from "@/lib/parse-xlsx";
import { getJobPlacements, type PlacementEntry } from "@/lib/parse-xlsx";
import { getPlacementReviews, getAverageRating, type PlacementReview } from "@/lib/placement-reviews";
import { findHospital } from "@/lib/hospitals";
import { getRegionStyle, REGION_COLORS } from "@/lib/region-colors";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ArrowLeft, Star, ExternalLink, Copy, Check, MapPin, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export { getRegionStyle, REGION_COLORS };

/* ── Props ── */

interface JobDetailPanelProps {
  job: Job;
  onClose: () => void;
  isMobile: boolean;
}

/* ── Star rating display ── */

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted-foreground/40"
          )}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

/* ── Placement card (clickable row in FY section) ── */

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

/* ── FY Section ── */

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
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </h3>
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

/* ── Review card ── */

function ReviewCard({ review }: { review: PlacementReview }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{review.author}</span>
        <span className="text-xs text-muted-foreground shrink-0">{review.date}</span>
      </div>
      <StarRating rating={review.rating} size={12} />
      <p className="text-xs text-muted-foreground leading-relaxed">{review.text}</p>
    </div>
  );
}

/* ── Copy button ── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
      title="Copy address"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ── Nested Placement Detail Card ── */

function PlacementDetailCard({
  entry,
  onBack,
  isMobile,
}: {
  entry: PlacementEntry;
  onBack: () => void;
  isMobile: boolean;
}) {
  const reviews = getPlacementReviews(entry.site, entry.spec);
  const avgRating = getAverageRating(reviews);
  const hospital = findHospital(entry.site);
  const mapCenter = useMemo(
    () => hospital ? { lat: hospital.lat, lng: hospital.lng } : { lat: 56.49, lng: -4.2 },
    [hospital]
  );

  return (
    <motion.div
      className={cn(
        "fixed z-50 flex flex-col bg-card shadow-2xl",
        isMobile
          ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl"
          : "top-0 right-0 bottom-0 w-96 border-l"
      )}
      initial={isMobile ? { y: "100%" } : { x: "100%" }}
      animate={isMobile ? { y: 0 } : { x: 0 }}
      exit={isMobile ? { y: "100%" } : { x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
    >
      {/* Drag handle (mobile) */}
      {isMobile && (
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-snug truncate">{entry.spec}</h2>
          <p className="text-sm font-semibold italic leading-snug truncate">{entry.site}</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Map */}
        <div className="p-4 pb-2">
          <div className="rounded-lg overflow-hidden border bg-muted h-[200px]">
            {MAPS_API_KEY ? (
              <APIProvider apiKey={MAPS_API_KEY}>
                <Map
                  defaultCenter={mapCenter}
                  defaultZoom={hospital ? 14 : 6}
                  gestureHandling="greedy"
                  disableDefaultUI
                  mapId="placement-map"
                >
                  {hospital && <AdvancedMarker position={mapCenter} />}
                </Map>
              </APIProvider>
            ) : (
              <iframe
                title={`Map of ${entry.site}`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(entry.site + " NHS Scotland")}&output=embed`}
                className="w-full h-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
        </div>

        {/* Hospital info */}
        {hospital && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 group/addr">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs whitespace-nowrap overflow-x-auto flex-1 min-w-0 scrollbar-none">{hospital.address}</span>
              <span className="opacity-0 group-hover/addr:opacity-100 transition-opacity shrink-0">
                <CopyButton text={hospital.address} />
              </span>
              <a
                href={hospital.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors whitespace-nowrap shrink-0"
              >
                Explore site
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Average rating */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3">
            <StarRating rating={avgRating} size={22} />
            <span className="text-lg font-bold">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">({reviews.length} reviews)</span>
          </div>
        </div>

        {/* Leave a review CTA */}
        <div className="px-4 pb-3">
          <div className="rounded-lg border p-5 flex flex-col items-center justify-center text-center gap-3">
            <p className="text-sm font-medium leading-snug">
              Leave a review for <span className="font-bold">{entry.spec}</span> at {entry.site}
            </p>
            <button className="rounded-full bg-primary hover:bg-primary/90 px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors flex items-center gap-1.5">
              <PenLine className="h-3.5 w-3.5" />
              Leave a review
            </button>
          </div>
        </div>

        {/* Description */}
        {entry.description && (
          <div className="px-4 pb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Description</h4>
            <p className="text-sm leading-relaxed">{entry.description}</p>
          </div>
        )}

        {/* Reviews */}
        <div className="px-4 py-2 pb-4 space-y-2">
          {reviews.map((review, i) => (
            <ReviewCard key={i} review={review} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Panel ── */

export function JobDetailPanel({ job, onClose, isMobile }: JobDetailPanelProps) {
  const style = getRegionStyle(job.region);
  const { fy1, fy2 } = getJobPlacements(job);
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementEntry | null>(null);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-background/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Main panel */}
      <motion.div
        className={cn(
          "fixed z-50 flex flex-col bg-card shadow-2xl",
          isMobile
            ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl"
            : "top-0 bottom-0 w-96 border-l"
        )}
        initial={isMobile ? { y: "100%" } : { x: "100%", right: 0 }}
        animate={isMobile ? { y: 0 } : { x: 0, right: selectedPlacement ? "24rem" : 0 }}
        exit={isMobile ? { y: "100%" } : { x: "100%", right: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* Drag handle (mobile) */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Header */}
        <div className={cn("px-5 py-4 border-b shrink-0", style.bg)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-tight truncate">
                {job.programmeTitle}
              </h2>
              <span
                className={cn(
                  "inline-block mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  style.bg,
                  style.border,
                  style.text,
                  "border"
                )}
              >
                {job.region}
              </span>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Placements */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-4 space-y-5">
          <FYSection
            label="FY1"
            entries={fy1}
            activePlacementNum={selectedPlacement?.num ?? null}
            onSelectPlacement={setSelectedPlacement}
          />
          {fy1.length > 0 && fy2.length > 0 && (
            <div className="border-t" />
          )}
          <FYSection
            label="FY2"
            entries={fy2}
            activePlacementNum={selectedPlacement?.num ?? null}
            onSelectPlacement={setSelectedPlacement}
          />
        </div>
      </motion.div>

      {/* Persistent backdrop behind nested panel to prevent flash on switch */}
      {selectedPlacement && (
        <div className={cn(
          "fixed z-50 bg-card shadow-2xl pointer-events-none",
          isMobile
            ? "inset-x-0 bottom-0 top-[12vh] rounded-t-2xl"
            : "top-0 right-0 bottom-0 w-96 border-l"
        )} />
      )}

      {/* Nested placement detail (stacks on top) */}
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
