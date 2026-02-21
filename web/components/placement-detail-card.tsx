"use client";

import { useMemo } from "react";
import type { PlacementEntry } from "@/lib/parse-xlsx";
import { getPlacementReviews, getAverageRating } from "@/lib/placement-reviews";
import { findHospital } from "@/lib/hospitals";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { motion } from "framer-motion";
import { ArrowLeft, Star, ExternalLink, MapPin, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/section-label";
import { CopyButton } from "@/components/copy-button";
import {
  STAR_RATING_MAX,
  MAP_DEFAULT_ZOOM,
  MAP_FALLBACK_ZOOM,
  SCOTLAND_CENTER_LAT,
  SCOTLAND_CENTER_LNG,
} from "@/lib/constants";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: STAR_RATING_MAX }, (_, i) => i + 1).map((star) => (
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

function ReviewCard({ review }: { review: { author: string; date: string; rating: number; text: string } }) {
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

function PlacementMapSection({ entry, hospital, mapCenter }: {
  entry: PlacementEntry;
  hospital: ReturnType<typeof findHospital>;
  mapCenter: { lat: number; lng: number };
}) {
  return (
    <div className="p-4 pb-2">
      <div className="rounded-lg overflow-hidden border bg-muted h-[200px]">
        {MAPS_API_KEY ? (
          <APIProvider apiKey={MAPS_API_KEY}>
            <Map
              defaultCenter={mapCenter}
              defaultZoom={hospital ? MAP_DEFAULT_ZOOM : MAP_FALLBACK_ZOOM}
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
  );
}

function HospitalAddressBar({ hospital }: { hospital: NonNullable<ReturnType<typeof findHospital>> }) {
  return (
    <div className="px-4 pb-3">
      <div className="flex items-center gap-2 group/addr">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs whitespace-nowrap overflow-x-auto flex-1 min-w-0 scrollbar-none">
          {hospital.address}
        </span>
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
  );
}

function LeaveReviewCard({ entry }: { entry: PlacementEntry }) {
  return (
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
  );
}

function RatingSummary({ avgRating, reviewCount }: { avgRating: number; reviewCount: number }) {
  return (
    <div className="px-4 pb-3">
      <div className="flex items-center gap-3">
        <StarRating rating={avgRating} size={22} />
        <span className="text-lg font-bold">{avgRating.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">({reviewCount} reviews)</span>
      </div>
    </div>
  );
}

function PlacementDetailBody({ entry }: { entry: PlacementEntry }) {
  const reviews = getPlacementReviews(entry.site, entry.spec);
  const avgRating = getAverageRating(reviews);
  const hospital = findHospital(entry.site);
  const mapCenter = useMemo(
    () => hospital
      ? { lat: hospital.lat, lng: hospital.lng }
      : { lat: SCOTLAND_CENTER_LAT, lng: SCOTLAND_CENTER_LNG },
    [hospital]
  );

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none">
      <PlacementMapSection entry={entry} hospital={hospital} mapCenter={mapCenter} />
      {hospital && <HospitalAddressBar hospital={hospital} />}
      <RatingSummary avgRating={avgRating} reviewCount={reviews.length} />
      <LeaveReviewCard entry={entry} />
      {entry.description && (
        <div className="px-4 pb-3">
          <SectionLabel as="h4" className="mb-1">Description</SectionLabel>
          <p className="text-sm leading-relaxed">{entry.description}</p>
        </div>
      )}
      <div className="px-4 py-2 pb-4 space-y-2">
        {reviews.map((review, i) => (
          <ReviewCard key={i} review={review} />
        ))}
      </div>
    </div>
  );
}

interface PlacementDetailCardProps {
  entry: PlacementEntry;
  onBack: () => void;
  isMobile: boolean;
}

export function PlacementDetailCard({ entry, onBack, isMobile }: PlacementDetailCardProps) {
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
      {isMobile && (
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
      )}
      <PlacementDetailHeader entry={entry} onBack={onBack} />
      <PlacementDetailBody entry={entry} />
    </motion.div>
  );
}

function PlacementDetailHeader({ entry, onBack }: { entry: PlacementEntry; onBack: () => void }) {
  return (
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
  );
}
