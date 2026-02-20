"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BlogSection } from "./blog-section";
import { RegionFilterBar } from "./region-filter-bar";
import { useRegionFilter } from "./region-filter-context";
import { REGION_HEX, type Region } from "@/lib/region-colors";
import type { RegionsData } from "@/lib/blog-data";

const chartConfig = {
  rotations: { label: "Rotations", color: "var(--chart-1)" },
  sites: { label: "Sites", color: "var(--chart-2)" },
  specialties: { label: "Specialties", color: "var(--chart-3)" },
} satisfies ChartConfig;

interface RegionBreakdownChartProps {
  data: RegionsData;
}

export function RegionBreakdownChart({ data }: RegionBreakdownChartProps) {
  const { activeRegion } = useRegionFilter();

  const chartData = (
    ["North", "East", "West", "South and SE"] as Region[]
  ).map((region) => ({
    region: region === "South and SE" ? "South & SE" : region,
    rotations: data[region].rotations,
    sites: data[region].sites,
    specialties: data[region].specialties,
    fill: REGION_HEX[region],
    opacity: activeRegion === null || activeRegion === region ? 1 : 0.2,
  }));

  return (
    <BlogSection id="regions">
      <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-center mb-4">
        Not all regions are created equal.
      </h2>
      <p className="text-lg sm:text-xl text-foreground text-center mb-8 max-w-2xl mx-auto">
        570 rotations in the West. 120 in the East. Here&apos;s how they
        compare.
      </p>

      <RegionFilterBar className="mb-8" />

      {/* Mobile: stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        {chartData.map((d) => (
          <div
            key={d.region}
            className="rounded-xl border-2 p-4 transition-opacity"
            style={{
              borderColor: d.fill,
              opacity: d.opacity,
            }}
          >
            <h3
              className="text-sm font-bold mb-2"
              style={{ color: d.fill }}
            >
              {d.region}
            </h3>
            <div className="space-y-1">
              <div>
                <span className="text-2xl font-black text-foreground">
                  {d.rotations}
                </span>
                <span className="text-xs font-semibold text-foreground ml-1">
                  rotations
                </span>
              </div>
              <div>
                <span className="text-lg font-bold text-foreground">
                  {d.sites}
                </span>
                <span className="text-xs font-semibold text-foreground ml-1">
                  sites
                </span>
              </div>
              <div>
                <span className="text-lg font-bold text-foreground">
                  {d.specialties}
                </span>
                <span className="text-xs font-semibold text-foreground ml-1">
                  specialties
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: grouped bar chart */}
      <div className="hidden sm:block">
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="region"
              tickLine={false}
              axisLine={false}
              className="font-semibold"
            />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="rotations"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              name="Rotations"
            />
            <Bar
              dataKey="sites"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              name="Sites"
            />
            <Bar
              dataKey="specialties"
              fill="var(--chart-3)"
              radius={[4, 4, 0, 0]}
              name="Specialties"
            />
          </BarChart>
        </ChartContainer>
      </div>
    </BlogSection>
  );
}
