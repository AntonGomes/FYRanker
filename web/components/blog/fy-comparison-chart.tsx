"use client";

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
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
import { REGION_HEX } from "@/lib/region-colors";
import type { FYComparisonData, FYSpecialtyEntry } from "@/lib/blog-data";

const TOP_N = 10;

const fy1Config = {
  pct: { label: "% of jobs", color: "var(--chart-1)" },
} satisfies ChartConfig;

const fy2Config = {
  pct: { label: "% of jobs", color: "var(--chart-3)" },
} satisfies ChartConfig;

interface FYComparisonChartProps {
  data: FYComparisonData;
}

function FYBarChart({
  title,
  entries,
  config,
  color,
}: {
  title: string;
  entries: FYSpecialtyEntry[];
  config: ChartConfig;
  color: string;
}) {
  const chartData = entries.slice(0, TOP_N).map((e) => ({
    name: e.name.length > 22 ? e.name.slice(0, 20) + "…" : e.name,
    fullName: e.name,
    pct: e.pct,
    count: e.count,
  }));

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-xl sm:text-2xl font-black text-center mb-4" style={{ color }}>
        {title}
      </h3>
      <ChartContainer config={config} className="h-[400px] w-full">
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
            width={140}
            tick={{ fontSize: 11, fontWeight: 600 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => (
                  <span className="font-semibold">
                    {item.payload.fullName}: {value}% ({item.payload.count}{" "}
                    jobs)
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} name="% of jobs">
            {chartData.map((_, i) => (
              <Cell key={i} fill={color} fillOpacity={1 - i * 0.06} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function FYComparisonChart({ data }: FYComparisonChartProps) {
  const { activeRegion } = useRegionFilter();

  const fy1Entries = activeRegion
    ? data.fy1.byRegion[activeRegion] ?? []
    : data.fy1.all;
  const fy2Entries = activeRegion
    ? data.fy2.byRegion[activeRegion] ?? []
    : data.fy2.all;

  const color = activeRegion ? REGION_HEX[activeRegion] : undefined;

  return (
    <BlogSection id="fy-comparison">
      <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-center mb-4">
        FY1 is Gen Med and Gen Surgery.
        <br />
        <span className="text-primary">FY2 is where it gets interesting.</span>
      </h2>
      <p className="text-lg sm:text-xl text-foreground text-center mb-8 max-w-2xl mx-auto">
        GP appears in <strong className="text-primary">45%</strong> of FY2 jobs — but never
        in FY1.
      </p>

      <RegionFilterBar className="mb-8" />

      <div className="flex flex-col md:flex-row gap-6">
        <FYBarChart
          title="FY1"
          entries={fy1Entries}
          config={fy1Config}
          color={color ?? "var(--chart-1)"}
        />
        <FYBarChart
          title="FY2"
          entries={fy2Entries}
          config={fy2Config}
          color={color ?? "var(--chart-3)"}
        />
      </div>
    </BlogSection>
  );
}
