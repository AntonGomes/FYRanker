"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RegionFilterProvider } from "@/components/blog/region-filter-context";
import { HeroSection } from "@/components/blog/hero-section";
import { RegionBreakdownChart } from "@/components/blog/region-breakdown-chart";
import { SpecialtyBubbleChart } from "@/components/blog/specialty-bubble-chart";
import { FYComparisonChart } from "@/components/blog/fy-comparison-chart";
import { PlacementDistributionChart } from "@/components/blog/placement-distribution-chart";
import { CohortCalloutSection } from "@/components/blog/cohort-callout-section";
import { CTASection } from "@/components/blog/cta-section";
import type { BlogData } from "@/lib/blog-data";


export default function Home() {
  const [data, setData] = useState<BlogData | null>(null);

  useEffect(() => {
    async function loadAllData() {
      const [overview, regions, specialtyTiers, fyComparison, placementDist, cohorts] =
        await Promise.all([
          fetch("/data/overview.json").then((r) => r.json()),
          fetch("/data/regions.json").then((r) => r.json()),
          fetch("/data/specialty-tiers.json").then((r) => r.json()),
          fetch("/data/fy-comparison.json").then((r) => r.json()),
          fetch("/data/placement-distribution.json").then((r) => r.json()),
          fetch("/data/cohorts.json").then((r) => r.json()),
        ]);

      setData({
        overview,
        regions,
        specialtyTiers,
        fyComparison,
        placementDist,
        cohorts,
      });
    }

    loadAllData();
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-2xl font-bold text-foreground animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <RegionFilterProvider>
      <div className="flex flex-col bg-background">
        <SiteHeader />
        <HeroSection data={data.overview} />
        <RegionBreakdownChart data={data.regions} />
        <SpecialtyBubbleChart data={data.specialtyTiers} />
        <FYComparisonChart data={data.fyComparison} />
        <PlacementDistributionChart data={data.placementDist} />
        <CohortCalloutSection data={data.cohorts} />
        <CTASection />
        <SiteFooter />
      </div>
    </RegionFilterProvider>
  );
}
