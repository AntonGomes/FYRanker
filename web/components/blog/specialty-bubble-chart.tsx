"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { hierarchy, pack } from "d3-hierarchy";
import { BlogSection } from "./blog-section";
import { RegionFilterBar } from "./region-filter-bar";
import { useRegionFilter } from "./region-filter-context";
import type { SpecialtyTiersData, SpecialtyTierEntry } from "@/lib/blog-data";

const TIER_LEGEND: { tier: string; label: string; color: string }[] = [
  { tier: "Legendary", label: "<0.5%", color: "#f59e0b" },
  { tier: "Epic", label: "0.5–1.5%", color: "#a855f7" },
  { tier: "Rare", label: "1.5–4%", color: "#3b82f6" },
  { tier: "Uncommon", label: "4–10%", color: "#22c55e" },
  { tier: "Common", label: "≥10%", color: "#64748b" },
];

interface BubbleNode {
  name: string;
  count: number;
  pct: number;
  tier: string;
  tierColor: string;
  x: number;
  y: number;
  r: number;
}

function computeLayout(
  entries: SpecialtyTierEntry[],
  size: number
): BubbleNode[] {
  if (!entries.length) return [];

  const root = hierarchy<{ children?: SpecialtyTierEntry[] }>({
    children: entries,
  })
    .sum((d) => (d as SpecialtyTierEntry).count ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const packer = pack<{ children?: SpecialtyTierEntry[] }>()
    .size([size, size])
    .padding(3);

  const packed = packer(root);

  return packed.leaves().map((leaf) => {
    const d = leaf.data as SpecialtyTierEntry;
    return {
      name: d.name,
      count: d.count,
      pct: d.pct,
      tier: d.tier,
      tierColor: d.tierColor,
      x: leaf.x,
      y: leaf.y,
      r: leaf.r,
    };
  });
}

interface TooltipState {
  x: number;
  y: number;
  node: BubbleNode;
}

interface SpecialtyBubbleChartProps {
  data: SpecialtyTiersData;
}

export function SpecialtyBubbleChart({ data }: SpecialtyBubbleChartProps) {
  const { activeRegion } = useRegionFilter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(600);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 600;
      setSize(Math.min(width, 800));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const entries = activeRegion ? data.byRegion[activeRegion] : data.all;

  const nodes = useMemo(
    () => computeLayout(entries ?? [], size),
    [entries, size]
  );

  // Minimum radius for showing labels
  const labelThreshold = size < 500 ? 25 : 18;

  return (
    <BlogSection id="bubble-chart">
      <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-center mb-4">
        How rare is your specialty?
      </h2>
      <p className="text-lg sm:text-xl text-foreground text-center mb-4 max-w-2xl mx-auto">
        General Medicine appears in{" "}
        <strong className="text-primary">84%</strong> of all jobs. Dermatology?
        Just <strong className="text-primary">0.2%</strong>.
      </p>

      <RegionFilterBar className="mb-8" />

      <div ref={containerRef} className="w-full relative">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-auto"
          style={{ maxHeight: "80vh" }}
        >
          <AnimatePresence mode="popLayout">
            {nodes.map((node) => (
              <motion.g
                key={node.name}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  x: node.x,
                  y: node.y,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                onMouseEnter={(e) => {
                  const svg = (e.target as SVGElement).closest("svg");
                  if (!svg) return;
                  const rect = svg.getBoundingClientRect();
                  const scaleX = rect.width / size;
                  const scaleY = rect.height / size;
                  setTooltip({
                    x: node.x * scaleX + rect.left,
                    y: node.y * scaleY + rect.top - node.r * scaleY - 10,
                    node,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <motion.circle
                  r={node.r}
                  fill={node.tierColor}
                  fillOpacity={0.15}
                  stroke={node.tierColor}
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                  initial={{ r: 0 }}
                  animate={{ r: node.r }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />

                {node.r > labelThreshold && (
                  <>
                    <text
                      textAnchor="middle"
                      dy="-0.1em"
                      fill={node.tierColor}
                      fontSize={Math.max(8, Math.min(14, node.r * 0.3))}
                      fontWeight={600}
                      className="pointer-events-none select-none"
                    >
                      {node.name.length > 18
                        ? node.name.slice(0, 16) + "…"
                        : node.name}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="1.2em"
                      fill={node.tierColor}
                      fillOpacity={0.7}
                      fontSize={Math.max(7, Math.min(11, node.r * 0.25))}
                      className="pointer-events-none select-none"
                    >
                      {node.count} ({node.pct}%)
                    </text>
                  </>
                )}
              </motion.g>
            ))}
          </AnimatePresence>
        </svg>

        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg bg-card border border-border shadow-lg text-sm"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-bold text-foreground">{tooltip.node.name}</p>
            <p className="text-foreground">
              <span className="font-semibold">{tooltip.node.count}</span> jobs (
              {tooltip.node.pct}%)
            </p>
            <p style={{ color: tooltip.node.tierColor }} className="font-semibold">
              {tooltip.node.tier}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-4 mt-6">
        {TIER_LEGEND.map(({ tier, label, color }) => (
          <div key={tier} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color, opacity: 0.6 }}
            />
            <span className="text-sm font-semibold" style={{ color }}>
              {tier}
            </span>
            <span className="text-xs text-foreground">({label})</span>
          </div>
        ))}
      </div>
    </BlogSection>
  );
}
