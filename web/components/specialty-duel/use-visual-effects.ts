"use client";

import { useState, useCallback } from "react";
import type { DeltaAnnotation } from "./neighbourhood-row";

export function useVisualEffects() {
  const [trackedItem, setTrackedItem] = useState<DeltaAnnotation | null>(null);
  const [loserAnnotation, setLoserAnnotation] = useState<DeltaAnnotation | null>(null);
  const [winSide, setWinSide] = useState<"left" | "right" | null>(null);
  const [loserFlyOff, setLoserFlyOff] = useState(false);
  const [loserEmoji, setLoserEmoji] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [glowKeyMap, setGlowKeyMap] = useState<Map<string, number>>(new Map());
  const [flashMap, setFlashMap] = useState<Map<string, "up" | "down">>(new Map());

  const reset = useCallback((): void => {
    setTrackedItem(null);
    setLoserAnnotation(null);
    setFlashMap(new Map());
    setWinSide(null);
    setLoserEmoji(null);
    setLoserFlyOff(false);
    setIsTransitioning(false);
  }, []);

  const applyGlowAndFlash = useCallback((ids: { winner: string; loser: string }): void => {
    setGlowKeyMap((prev) => {
      const next = new Map(prev);
      next.set(ids.winner, (next.get(ids.winner) ?? 0) + 1);
      next.set(ids.loser, (next.get(ids.loser) ?? 0) + 1);
      return next;
    });
    setFlashMap(() => {
      const next = new Map<string, "up" | "down">();
      next.set(ids.winner, "up");
      next.set(ids.loser, "down");
      return next;
    });
  }, []);

  return {
    trackedItem, setTrackedItem, loserAnnotation, setLoserAnnotation,
    winSide, setWinSide, loserFlyOff, setLoserFlyOff,
    loserEmoji, setLoserEmoji, isTransitioning, setIsTransitioning,
    glowKeyMap, flashMap, reset, applyGlowAndFlash,
  };
}
