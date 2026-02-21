"use client";

import type React from "react";
import { motion } from "framer-motion";
import { BlogSection } from "./blog-section";
import { useRegionFilter } from "./region-filter-context";
import { RegionFilterBar } from "./region-filter-bar";
import { REGION_HEX } from "@/lib/region-colors";
import type { CohortsData } from "@/lib/blog-data";

interface CohortCalloutSectionProps {
  data: CohortsData;
}

interface CohortExtremes {
  site: string;
  specialty: string;
  placement: number;
  count: number;
  region: string;
}

function computeExtremes(data: CohortsData, regions: (keyof CohortsData)[]) {
  let largest: CohortExtremes = { site: "", specialty: "", placement: 0, count: 0, region: "" };
  let smallest: CohortExtremes = { site: "", specialty: "", placement: 0, count: Infinity, region: "" };
  for (const region of regions) {
    const regionData = data[region];
    if (!regionData) continue;
    for (const c of regionData.largest) {
      if (c.count > largest.count) largest = { ...c, region };
    }
    for (const c of regionData.smallest) {
      if (c.count < smallest.count) smallest = { ...c, region };
    }
  }
  return { largest, smallest };
}

function CohortCard({
  label,
  unit,
  cohort,
  accentColor,
  motionProps,
}: {
  label: string;
  unit: string;
  cohort: CohortExtremes;
  accentColor: string;
  motionProps: Pick<React.ComponentProps<typeof motion.div>, "initial" | "whileInView" | "viewport" | "transition">;
}) {
  return (
    <motion.div
      className="rounded-2xl border-2 p-8 text-center"
      style={{ borderColor: accentColor }}
      {...motionProps}
    >
      <p className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-6xl sm:text-7xl font-black" style={{ color: accentColor }}>
        {cohort.count}
      </p>
      <p className="text-sm font-semibold text-foreground mt-1">{unit}</p>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-bold text-foreground">{cohort.site}</p>
        <p className="text-sm text-foreground">
          {cohort.specialty} — Placement {cohort.placement}
        </p>
        <p
          className="text-xs font-semibold"
          style={{ color: REGION_HEX[cohort.region as keyof typeof REGION_HEX] ?? accentColor }}
        >
          {cohort.region}
        </p>
      </div>
    </motion.div>
  );
}

export function CohortCalloutSection({ data }: CohortCalloutSectionProps) {
  const { activeRegion } = useRegionFilter();
  const regions = activeRegion
    ? [activeRegion]
    : (Object.keys(data) as (keyof CohortsData)[]);
  const { largest, smallest } = computeExtremes(data, regions);
  const accentColor = activeRegion ? REGION_HEX[activeRegion] : "var(--primary)";

  return (
    <BlogSection id="cohorts">
      <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-center mb-4">
        You could start with{" "}
        <span style={{ color: accentColor }}>{largest.count} others</span>.
        <br />
        Or just <span style={{ color: accentColor }}>1</span>.
      </h2>
      <p className="text-lg sm:text-xl text-foreground text-center mb-8 max-w-2xl mx-auto">
        Cohort sizes range from solo placements to packed wards.
      </p>
      <RegionFilterBar className="mb-10" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <CohortCard
          label="Largest cohort"
          unit="people"
          cohort={largest}
          accentColor={accentColor}
          motionProps={{
            initial: { opacity: 0, x: -30 },
            whileInView: { opacity: 1, x: 0 },
            viewport: { once: true },
            transition: { duration: 0.6 },
          }}
        />
        <CohortCard
          label="Smallest cohort"
          unit="person"
          cohort={smallest}
          accentColor={accentColor}
          motionProps={{
            initial: { opacity: 0, x: 30 },
            whileInView: { opacity: 1, x: 0 },
            viewport: { once: true },
            transition: { duration: 0.6, delay: 0.2 },
          }}
        />
      </div>
    </BlogSection>
  );
}
