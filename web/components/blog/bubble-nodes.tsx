"use client";

import { motion, AnimatePresence } from "framer-motion";

export interface BubbleNodeData {
  name: string;
  count: number;
  pct: number;
  tier: string;
  tierColor: string;
  x: number;
  y: number;
  r: number;
}

const LABEL_FONT_SIZE_MIN = 8;
const LABEL_FONT_SIZE_MAX = 14;
const LABEL_FONT_SCALE = 0.3;
const SUBLABEL_FONT_SIZE_MIN = 7;
const SUBLABEL_FONT_SIZE_MAX = 11;
const SUBLABEL_FONT_SCALE = 0.25;
const NAME_TRUNCATE_AT = 18;
const NAME_SLICE_AT = 16;

export interface TooltipState {
  x: number;
  y: number;
  node: BubbleNodeData;
}

export function BubbleTooltip({ tooltip }: { tooltip: TooltipState }): React.ReactNode {
  return (
    <div
      className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg bg-card border border-border shadow-lg text-sm"
      style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
    >
      <p className="font-bold text-foreground">{tooltip.node.name}</p>
      <p className="text-foreground">
        <span className="font-semibold">{tooltip.node.count}</span> jobs ({tooltip.node.pct}%)
      </p>
      <p style={{ color: tooltip.node.tierColor }} className="font-semibold">
        {tooltip.node.tier}
      </p>
    </div>
  );
}

function BubbleLabels({ node, labelThreshold }: { node: BubbleNodeData; labelThreshold: number }): React.ReactNode {
  if (node.r <= labelThreshold) return null;

  const displayName = node.name.length > NAME_TRUNCATE_AT
    ? node.name.slice(0, NAME_SLICE_AT) + "…"
    : node.name;

  return (
    <>
      <text
        textAnchor="middle"
        dy="-0.1em"
        fill={node.tierColor}
        fontSize={Math.max(LABEL_FONT_SIZE_MIN, Math.min(LABEL_FONT_SIZE_MAX, node.r * LABEL_FONT_SCALE))}
        fontWeight={600}
        className="pointer-events-none select-none"
      >
        {displayName}
      </text>
      <text
        textAnchor="middle"
        dy="1.2em"
        fill={node.tierColor}
        fillOpacity={0.7}
        fontSize={Math.max(SUBLABEL_FONT_SIZE_MIN, Math.min(SUBLABEL_FONT_SIZE_MAX, node.r * SUBLABEL_FONT_SCALE))}
        className="pointer-events-none select-none"
      >
        {node.count} ({node.pct}%)
      </text>
    </>
  );
}

function BubbleCircle({
  node,
  labelThreshold,
  onHover,
  onLeave,
}: {
  node: BubbleNodeData;
  labelThreshold: number;
  onHover: (e: React.MouseEvent, node: BubbleNodeData) => void;
  onLeave: () => void;
}): React.ReactNode {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: node.x, y: node.y }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      onMouseEnter={(e) => onHover(e as unknown as React.MouseEvent, node)}
      onMouseLeave={onLeave}
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
      <BubbleLabels node={node} labelThreshold={labelThreshold} />
    </motion.g>
  );
}

export function BubbleSvg({
  nodes,
  size,
  labelThreshold,
  onHover,
  onLeave,
}: {
  nodes: BubbleNodeData[];
  size: number;
  labelThreshold: number;
  onHover: (e: React.MouseEvent, node: BubbleNodeData) => void;
  onLeave: () => void;
}): React.ReactNode {
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto" style={{ maxHeight: "80vh" }}>
      <AnimatePresence mode="popLayout">
        {nodes.map((node) => (
          <BubbleCircle
            key={node.name}
            node={node}
            labelThreshold={labelThreshold}
            onHover={onHover}
            onLeave={onLeave}
          />
        ))}
      </AnimatePresence>
    </svg>
  );
}
