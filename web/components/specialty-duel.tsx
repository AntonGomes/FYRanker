"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { ChevronsLeft, ChevronLeft, Equal, ChevronRight, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type EloState,
  type RankingEntry,
  initElo,
  updateElo,
  selectNextMatchup,
  getConfidence,
  toRankedList,
  getRankingNeighbourhood,
} from "@/lib/elo";
import type { SortableItem } from "@/components/sortable-list";

interface SpecialtyDuelProps {
  specialties: string[];
  eloState: EloState | null;
  onStateChange: (state: EloState) => void;
  onRankingChange: (items: SortableItem[]) => void;
  movedIds?: Set<string>;
}

const PREFERENCE_OPTIONS = [
  { weight: -2, icon: ChevronsLeft, label: "Strong", color: "bg-blue-600 hover:bg-blue-700 text-white" },
  { weight: -1, icon: ChevronLeft, label: "Slight", color: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 dark:text-blue-300" },
  { weight: 0, icon: Equal, label: "Draw", color: "bg-muted hover:bg-muted/80 text-foreground" },
  { weight: 1, icon: ChevronRight, label: "Slight", color: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300" },
  { weight: 2, icon: ChevronsRight, label: "Strong", color: "bg-amber-600 hover:bg-amber-700 text-white" },
] as const;

const SPRING = { type: "spring" as const, stiffness: 500, damping: 35, mass: 0.8 };

export function SpecialtyDuel({
  specialties,
  eloState,
  onStateChange,
  onRankingChange,
  movedIds,
}: SpecialtyDuelProps) {
  const state = eloState ?? initElo(specialties);

  const [currentMatchup, setCurrentMatchup] = useState<[string, string]>(() =>
    selectNextMatchup(state, movedIds)
  );
  const [neighbourhood, setNeighbourhood] = useState<RankingEntry[]>([]);
  const [prevRanks, setPrevRanks] = useState<Map<string, number>>(new Map());
  const glowKeys = useRef<Map<string, number>>(new Map());

  // Track which items moved after comparison
  const [movedItems, setMovedItems] = useState<Map<string, "up" | "down">>(new Map());

  const confidence = useMemo(
    () => getConfidence(state, movedIds?.size),
    [state, movedIds?.size]
  );
  const totalComparisons = state.history.length;

  const handleComparison = useCallback(
    (weight: number) => {
      const [a, b] = currentMatchup;

      // Snapshot ranks before update
      const sortedBefore = Array.from(state.ratings.entries())
        .sort((x, y) => y[1] - x[1])
        .map(([name], i) => [name, i + 1] as const);
      const ranksBefore = new Map(sortedBefore);

      // Update ELO
      const newState = updateElo(state, a, b, weight);

      // Compute ranks after
      const sortedAfter = Array.from(newState.ratings.entries())
        .sort((x, y) => y[1] - x[1])
        .map(([name], i) => [name, i + 1] as const);
      const ranksAfter = new Map(sortedAfter);

      // Detect movement
      const moved = new Map<string, "up" | "down">();
      for (const [name, rankAfter] of ranksAfter) {
        const rankBefore = ranksBefore.get(name) ?? rankAfter;
        if (rankAfter < rankBefore) moved.set(name, "up");
        else if (rankAfter > rankBefore) moved.set(name, "down");
      }

      // Increment glow keys for moved items
      for (const name of moved.keys()) {
        glowKeys.current.set(name, (glowKeys.current.get(name) ?? 0) + 1);
      }

      setMovedItems(moved);
      setPrevRanks(ranksBefore);
      setNeighbourhood(getRankingNeighbourhood(newState, a, b, 7));

      onStateChange(newState);
      onRankingChange(toRankedList(newState));

      setCurrentMatchup(selectNextMatchup(newState, movedIds));
    },
    [currentMatchup, state, onStateChange, onRankingChange, movedIds]
  );

  const [leftSpec, rightSpec] = currentMatchup;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-foreground">
            {totalComparisons} comparison{totalComparisons !== 1 ? "s" : ""}
          </span>
          <span className="font-medium text-foreground">
            {Math.round(confidence * 100)}% confidence
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Matchup cards */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0 rounded-lg border-2 border-blue-500/30 bg-blue-500/5 p-3 flex items-center justify-center">
          <span className="text-sm font-bold text-center leading-tight text-foreground">
            {leftSpec}
          </span>
        </div>
        <div className="flex items-center px-1">
          <span className="text-xs font-bold text-muted-foreground">vs</span>
        </div>
        <div className="flex-1 min-w-0 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-center">
          <span className="text-sm font-bold text-center leading-tight text-foreground">
            {rightSpec}
          </span>
        </div>
      </div>

      {/* 5-point preference scale */}
      <div className="flex gap-1">
        {PREFERENCE_OPTIONS.map(({ weight, icon: Icon, label, color }) => (
          <button
            key={weight}
            onClick={() => handleComparison(weight)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg h-12 transition-colors cursor-pointer",
              color
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </button>
        ))}
      </div>

      {/* Ranking neighbourhood */}
      {neighbourhood.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Rankings near this matchup
          </p>
          <LayoutGroup>
            <div className="space-y-1">
              <AnimatePresence mode="popLayout">
                {neighbourhood.map((entry) => {
                  const direction = movedItems.get(entry.id);
                  const gk = glowKeys.current.get(entry.id) ?? 0;
                  const isInMatchup = entry.id === leftSpec || entry.id === rightSpec;

                  return (
                    <motion.div
                      key={entry.id}
                      layoutId={`duel-rank-${entry.id}`}
                      layout="position"
                      transition={SPRING}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5",
                        isInMatchup
                          ? "bg-primary/8 border border-primary/20"
                          : "bg-muted/50",
                        direction === "up" && "animate-card-glow-up-fast",
                        direction === "down" && "animate-card-glow-down-fast"
                      )}
                      style={
                        direction
                          ? { animationName: direction === "up" ? "card-glow-up" : "card-glow-down" }
                          : undefined
                      }
                    >
                      <span className="text-xs font-mono font-bold text-muted-foreground w-6 text-right tabular-nums">
                        #{entry.rank}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-foreground truncate">
                        {entry.label}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">
                        {entry.rating}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>
      )}

      {/* Initial prompt when no comparisons yet */}
      {neighbourhood.length === 0 && totalComparisons === 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground/20 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Pick your preference above to start building your ranking
          </p>
        </div>
      )}
    </div>
  );
}
