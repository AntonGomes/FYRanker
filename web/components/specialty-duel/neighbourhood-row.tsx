"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowUp } from "lucide-react";
import { SPRING } from "@/lib/animation-presets";
import type { RankingEntry } from "@/lib/elo";

interface DeltaAnnotation {
  id: string;
  delta: number;
}

interface NeighbourhoodRowProps {
  entry: RankingEntry;
  isInMatchup: boolean;
  trackedItem: DeltaAnnotation | null;
  loserAnnotation: DeltaAnnotation | null;
  flashDir: "up" | "down" | undefined;
  glowKey: number;
}

function WinnerBadge({ delta }: { delta: number }) {
  return (
    <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
      <ArrowUp className="h-2.5 w-2.5" />
      +{delta}
    </span>
  );
}

function LoserBadge({ delta }: { delta: number }) {
  return (
    <span className="text-[9px] font-bold text-red-500 dark:text-red-400">
      {delta}
    </span>
  );
}

function rowClassName(flashDir: "up" | "down" | undefined, isInMatchup: boolean): string {
  if (flashDir === "up") return "animate-card-glow-up-fast";
  if (flashDir === "down") return "animate-card-glow-down-fast";
  if (isInMatchup) return "bg-primary/10 dark:bg-primary/15";
  return "bg-muted/30";
}

export function NeighbourhoodRow(props: NeighbourhoodRowProps) {
  const { entry, isInMatchup, trackedItem, loserAnnotation, flashDir, glowKey } = props;
  const isWinner = trackedItem?.id === entry.id;
  const isLoser = loserAnnotation?.id === entry.id;

  return (
    <motion.div
      key={entry.id}
      layoutId={`duel-rank-${entry.id}`}
      layout="position"
      transition={SPRING}
    >
      <div
        key={glowKey}
        className={cn("flex items-center gap-2 rounded px-2 py-1", rowClassName(flashDir, isInMatchup))}
      >
        <span className="text-xs font-mono font-bold text-muted-foreground w-5 text-right tabular-nums">
          #{entry.rank}
        </span>
        <span className={cn(
          "flex-1 text-xs sm:text-sm text-foreground truncate",
          isInMatchup ? "font-semibold" : "font-medium"
        )}>
          {entry.label}
        </span>
        {isWinner && trackedItem.delta > 0 && <WinnerBadge delta={trackedItem.delta} />}
        {isLoser && loserAnnotation.delta < 0 && <LoserBadge delta={loserAnnotation.delta} />}
      </div>
    </motion.div>
  );
}

export type { DeltaAnnotation };
