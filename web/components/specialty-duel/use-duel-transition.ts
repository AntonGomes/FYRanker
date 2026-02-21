"use client";

import { useState, useCallback } from "react";
import {
  type EloState,
  updateElo,
  selectNextMatchup,
  toRankedList,
  getFocusedNeighbourhood,
  type RankingEntry,
} from "@/lib/elo";
import type { SortableItem } from "@/components/sortable-list";
import { NEIGHBOURHOOD_SIZE, LOSER_FLY_DELAY_MS, NEXT_MATCHUP_DELAY_MS, LOSER_EMOJIS } from "./constants";
import { randomPick, computeRanks } from "./utils";
import { useVisualEffects } from "./use-visual-effects";

interface DuelTransitionConfig {
  state: EloState;
  movedIds: Set<string> | undefined;
  onStateChange: (state: EloState) => void;
  onRankingChange: (items: SortableItem[]) => void;
}

function focusedNeighbourhood(s: EloState, focal: string): RankingEntry[] {
  return getFocusedNeighbourhood({ state: s, focal, windowSize: NEIGHBOURHOOD_SIZE });
}

export function useDuelTransition(config: DuelTransitionConfig) {
  const { state, movedIds, onStateChange, onRankingChange } = config;

  const [currentMatchup, setCurrentMatchup] = useState<[string, string]>(() =>
    selectNextMatchup(state, movedIds)
  );
  const [neighbourhood, setNeighbourhood] = useState<RankingEntry[]>(() =>
    focusedNeighbourhood(state, currentMatchup[0])
  );
  const [sliderValue, setSliderValue] = useState(0);
  const [matchupKey, setMatchupKey] = useState(0);
  const fx = useVisualEffects();

  const advanceToNextMatchup = useCallback((newState: EloState): void => {
    setMatchupKey((k) => k + 1);
    const next = selectNextMatchup(newState, movedIds);
    setCurrentMatchup(next);
    setNeighbourhood(focusedNeighbourhood(newState, next[0]));
    setSliderValue(0);
  }, [movedIds]);

  const handleComparison = useCallback(
    (weight: number) => {
      if (fx.isTransitioning) return;
      const [a, b] = currentMatchup;
      const newState = updateElo({ state, a, b, weight });
      onStateChange(newState);
      onRankingChange(toRankedList(newState));
      if (weight === 0) { advanceToNextMatchup(newState); return; }
      applyWinLossFromArgs({ fx, oldState: state, newState, a, b, weight, setNeighbourhood, advanceToNextMatchup });
    },
    [currentMatchup, state, onStateChange, onRankingChange, advanceToNextMatchup, fx],
  );

  return {
    currentMatchup, neighbourhood, sliderValue, isTransitioning: fx.isTransitioning,
    matchupKey, trackedItem: fx.trackedItem, loserAnnotation: fx.loserAnnotation,
    winSide: fx.winSide, loserFlyOff: fx.loserFlyOff, loserEmoji: fx.loserEmoji,
    glowKeyMap: fx.glowKeyMap, flashMap: fx.flashMap,
    setSliderValue, handleComparison,
  };
}

interface ApplyWinLossArgs {
  fx: ReturnType<typeof useVisualEffects>;
  oldState: EloState;
  newState: EloState;
  a: string;
  b: string;
  weight: number;
  setNeighbourhood: React.Dispatch<React.SetStateAction<RankingEntry[]>>;
  advanceToNextMatchup: (s: EloState) => void;
}

function applyWinLossFromArgs(args: ApplyWinLossArgs): void {
  const { fx, oldState, newState, a, b, weight, setNeighbourhood, advanceToNextMatchup } = args;
  const ranksBefore = computeRanks(oldState.ratings);
  const ranksAfter = computeRanks(newState.ratings);
  const winner = weight < 0 ? a : b;
  const loser = weight < 0 ? b : a;

  fx.applyGlowAndFlash({ winner, loser });
  fx.setWinSide(weight < 0 ? "left" : "right");
  fx.setLoserEmoji(randomPick(LOSER_EMOJIS));
  fx.setLoserFlyOff(false);
  fx.setTrackedItem({ id: winner, delta: (ranksBefore.get(winner) ?? 0) - (ranksAfter.get(winner) ?? 0) });
  fx.setLoserAnnotation({ id: loser, delta: (ranksBefore.get(loser) ?? 0) - (ranksAfter.get(loser) ?? 0) });
  setNeighbourhood(focusedNeighbourhood(newState, winner));
  fx.setIsTransitioning(true);

  setTimeout(() => fx.setLoserFlyOff(true), LOSER_FLY_DELAY_MS);
  setTimeout(() => {
    fx.reset();
    advanceToNextMatchup(newState);
  }, NEXT_MATCHUP_DELAY_MS);
}
