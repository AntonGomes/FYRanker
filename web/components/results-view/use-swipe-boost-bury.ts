"use client";

import { useState, useCallback, useRef } from "react";

const SWIPE_THRESHOLD = 60;
const SWIPE_ABORT_RATIO = 1.5;
const SWIPE_MIN_DX = 10;
const SWIPE_COMMITTED_RESET_MS = 400;

export const SWIPE_BOOST_THRESHOLD = 15;
export const SWIPE_BURY_THRESHOLD = -15;

type SwipeAction = "boost" | "bury" | null;
type TouchState = { x: number; y: number; aborted: boolean };

interface SwipeParams {
  onBoost: () => void;
  onBury: () => void;
  isDragging: boolean;
  isLocked: boolean;
}

interface SwipeResult {
  swipeX: number;
  swipeCommitted: SwipeAction;
  pendingAction: SwipeAction;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

function resolveSwipeAction(dx: number): SwipeAction {
  if (dx >= SWIPE_THRESHOLD) return "boost";
  if (dx <= -SWIPE_THRESHOLD) return "bury";
  return null;
}

function isVerticalScroll(dx: number, dy: number): boolean {
  return (
    Math.abs(dy) > Math.abs(dx) * SWIPE_ABORT_RATIO &&
    Math.abs(dy) > SWIPE_MIN_DX
  );
}

function useSwipeBoostBury(params: SwipeParams): SwipeResult {
  const { onBoost, onBury, isDragging, isLocked } = params;
  const touchRef = useRef<TouchState | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeCommitted, setSwipeCommitted] = useState<SwipeAction>(null);
  const [pendingAction, setPendingAction] = useState<SwipeAction>(null);
  const resetSwipe = useCallback(() => { setSwipeX(0); setPendingAction(null); }, []);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isDragging || isLocked) return;
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, aborted: false };
    setSwipeX(0); setSwipeCommitted(null); setPendingAction(null);
  }, [isDragging, isLocked]);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const ref = touchRef.current;
    if (!ref || ref.aborted || isDragging) return;
    const t = e.touches[0];
    const dx = t.clientX - ref.x;
    const dy = t.clientY - ref.y;
    if (isVerticalScroll(dx, dy)) { ref.aborted = true; resetSwipe(); return; }
    if (Math.abs(dx) > SWIPE_MIN_DX) {
      setSwipeX(dx);
      setPendingAction(resolveSwipeAction(dx));
    }
  }, [isDragging, resetSwipe]);
  const onTouchEnd = useCallback(() => {
    const ref = touchRef.current;
    touchRef.current = null;
    if (!ref || ref.aborted) { resetSwipe(); return; }
    if (pendingAction === "boost") { setSwipeCommitted("boost"); onBoost(); }
    else if (pendingAction === "bury") { setSwipeCommitted("bury"); onBury(); }
    resetSwipe();
    setTimeout(() => setSwipeCommitted(null), SWIPE_COMMITTED_RESET_MS);
  }, [pendingAction, onBoost, onBury, resetSwipe]);
  return { swipeX, swipeCommitted, pendingAction, onTouchStart, onTouchMove, onTouchEnd };
}

export { useSwipeBoostBury };
