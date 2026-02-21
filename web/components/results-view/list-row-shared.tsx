"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlacementEntry } from "@/lib/parse-xlsx";
import { cn } from "@/lib/utils";


function RankChangeBadge({
  delta,
  direction,
}: {
  delta: number | null;
  direction: "up" | "down" | null;
}): React.JSX.Element {
  return (
    <AnimatePresence>
      {delta != null && delta !== 0 && direction && (
        <motion.span
          key={delta}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-bold font-mono tabular-nums leading-tight",
            direction === "up"
              ? "bg-emerald-900/50 text-emerald-300"
              : "bg-red-900/50 text-red-300"
          )}
        >
          {direction === "up" ? "+" : ""}
          {delta}
        </motion.span>
      )}
    </AnimatePresence>
  );
}


function ArrowUp(): React.JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="M5 12L12 5L19 12" />
    </svg>
  );
}

function ArrowDown(): React.JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5V19" />
      <path d="M19 12L12 19L5 12" />
    </svg>
  );
}


const PlacementRow = memo(function PlacementRow({
  entry,
}: {
  entry: PlacementEntry;
}): React.JSX.Element {
  return (
    <div className="flex gap-2 items-start py-0.5">
      <span className="w-4 shrink-0 text-xs font-mono font-semibold text-muted-foreground text-right pt-0.5">
        {entry.num}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground leading-tight truncate">
          {entry.spec || "No specialty listed"}
        </p>
        <p className="text-xs font-semibold italic text-foreground leading-tight truncate">
          {entry.site || "No site listed"}
        </p>
      </div>
    </div>
  );
});


const FYGroup = memo(function FYGroup({
  label,
  entries,
}: {
  label: string;
  entries: PlacementEntry[];
}): React.JSX.Element {
  const slots: (PlacementEntry | null)[] = [
    entries[0] ?? null,
    entries[1] ?? null,
    entries[2] ?? null,
  ];

  return (
    <div className="flex items-stretch gap-0">
      <div className="flex items-center shrink-0 pr-1.5">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mr-1 whitespace-nowrap">
          {label}
        </span>
        <FYBracketSvg />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        {slots.map((entry, i) =>
          entry ? (
            <PlacementRow key={entry.num} entry={entry} />
          ) : (
            <EmptyPlacementSlot key={i} />
          )
        )}
      </div>
    </div>
  );
});


function FYBracketSvg(): React.JSX.Element {
  return (
    <svg
      className="text-muted-foreground shrink-0"
      width="10"
      viewBox="0 0 10 60"
      preserveAspectRatio="none"
      style={{ height: "100%" }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M10,2 Q4,2 4,15 Q4,28 0,30 Q4,32 4,45 Q4,58 10,58" />
    </svg>
  );
}


function EmptyPlacementSlot(): React.JSX.Element {
  return (
    <div className="flex gap-2 items-start py-0.5">
      <span className="w-4 shrink-0 text-xs font-mono font-semibold text-muted-foreground text-right pt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">
          No placement
        </p>
        <p className="text-xs text-muted-foreground leading-tight">
          &nbsp;
        </p>
      </div>
    </div>
  );
}


const PlacementList = memo(function PlacementList({
  fy1,
  fy2,
}: {
  fy1: PlacementEntry[];
  fy2: PlacementEntry[];
}): React.JSX.Element {
  return (
    <div className="space-y-0.5">
      <FYGroup label="FY1" entries={fy1} />
      <FYGroup label="FY2" entries={fy2} />
    </div>
  );
});


export {
  RankChangeBadge,
  ArrowUp,
  ArrowDown,
  PlacementRow,
  FYGroup,
  PlacementList,
};
