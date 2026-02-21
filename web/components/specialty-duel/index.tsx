"use client";

import { type EloState, initElo } from "@/lib/elo";
import type { SortableItem } from "@/components/sortable-list";
import { useDarkMode } from "./use-dark-mode";
import { useDuelTransition } from "./use-duel-transition";
import { getCardStyle } from "./utils";
import { DuelArena } from "./duel-arena";
import { NeighbourhoodPanel } from "./neighbourhood-panel";

interface SpecialtyDuelProps {
  specialties: string[];
  eloState: EloState | null;
  onStateChange: (state: EloState) => void;
  onRankingChange: (items: SortableItem[]) => void;
  movedIds?: Set<string>;
}

export function SpecialtyDuel({
  specialties,
  eloState,
  onStateChange,
  onRankingChange,
  movedIds,
}: SpecialtyDuelProps) {
  const state = eloState ?? initElo(specialties);
  const isDark = useDarkMode();

  const t = useDuelTransition({ state, movedIds, onStateChange, onRankingChange });
  const [leftSpec, rightSpec] = t.currentMatchup;

  const leftGlow = Math.max(0, -t.sliderValue) / 2;
  const rightGlow = Math.max(0, t.sliderValue) / 2;

  return (
    <div className="flex flex-col flex-1 min-h-0 justify-evenly gap-2">
      <NeighbourhoodPanel
        neighbourhood={t.neighbourhood}
        leftSpec={leftSpec}
        rightSpec={rightSpec}
        trackedItem={t.trackedItem}
        loserAnnotation={t.loserAnnotation}
        flashMap={t.flashMap}
        glowKeyMap={t.glowKeyMap}
      />
      <DuelArena
        leftSpec={leftSpec}
        rightSpec={rightSpec}
        transition={t}
        leftStyle={getCardStyle(leftGlow, isDark)}
        rightStyle={getCardStyle(rightGlow, isDark)}
        leftGlow={leftGlow}
        rightGlow={rightGlow}
      />
    </div>
  );
}
