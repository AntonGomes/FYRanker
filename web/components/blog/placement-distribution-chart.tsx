"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BlogSection } from "./blog-section";
import { RegionFilterBar } from "./region-filter-bar";
import { useRegionFilter } from "./region-filter-context";
import type { PlacementDistData } from "@/lib/blog-data";

const SEGMENT_COLORS = [
  "#3b82f6", // 1 placement - blue
  "#22c55e", // 2 placements - green
  "#f59e0b", // 3 placements - amber
  "#ef4444", // 4 placements - red
  "#a855f7", // 5 placements - purple
  "#ec4899", // 6 placements - pink
];

const chartConfig: ChartConfig = {
  p1: { label: "1 placement", color: SEGMENT_COLORS[0] },
  p2: { label: "2 placements", color: SEGMENT_COLORS[1] },
  p3: { label: "3 placements", color: SEGMENT_COLORS[2] },
  p4: { label: "4 placements", color: SEGMENT_COLORS[3] },
  p5: { label: "5 placements", color: SEGMENT_COLORS[4] },
  p6: { label: "6 placements", color: SEGMENT_COLORS[5] },
};

interface PlacementDistributionChartProps {
  data: PlacementDistData;
}

export function PlacementDistributionChart({
  data,
}: PlacementDistributionChartProps) {
  const { activeRegion } = useRegionFilter();

  const chartData = data.specialties.map((spec) => {
    const dist = activeRegion
      ? spec.byRegion[activeRegion]?.distribution ?? {}
      : spec.distribution;
    const totalJobs = activeRegion
      ? spec.byRegion[activeRegion]?.totalJobs ?? 1
      : data.totalJobs;

    // Convert counts to percentages of total jobs
    const row: Record<string, string | number> = {
      name:
        spec.name.length > 25 ? spec.name.slice(0, 23) + "…" : spec.name,
      fullName: spec.name,
    };
    for (let i = 1; i <= 6; i++) {
      const count = dist[String(i)] ?? 0;
      row[`p${i}`] = Math.round((count / totalJobs) * 100);
    }
    return row;
  });

  // Only show segments that have data
  const activeKeys = Array.from({ length: 6 }, (_, i) => `p${i + 1}`).filter(
    (key) => chartData.some((d) => (d[key] as number) > 0)
  );

  return (
    <BlogSection id="placement-dist">
      <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-center mb-4">
        Some specialties don&apos;t just appear.
        <br />
        <span className="text-primary">They dominate.</span>
      </h2>
      <p className="text-lg sm:text-xl text-foreground text-center mb-8 max-w-2xl mx-auto">
        How many of your 6 placements will be the same specialty?
      </p>

      <RegionFilterBar className="mb-8" />

      <ChartContainer config={chartConfig} className="h-[350px] sm:h-[400px] w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={150}
            tick={{ fontSize: 11, fontWeight: 600 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  const label =
                    chartConfig[name as keyof typeof chartConfig]?.label ??
                    name;
                  return (
                    <span className="font-semibold">
                      {item.payload.fullName}: {value}% with {label}
                    </span>
                  );
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {activeKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="stack"
              fill={SEGMENT_COLORS[i]}
              radius={
                i === activeKeys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]
              }
              name={key}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </BlogSection>
  );
}
