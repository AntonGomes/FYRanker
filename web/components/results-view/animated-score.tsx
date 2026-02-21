"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SCORE_DISPLAY_DECIMALS } from "@/lib/constants";

const SCORE_DIFF_THRESHOLD = 0.0001;
const SCORE_ANIM_DURATION_MS = 700;
const EASING_EXPONENT = 3;
const FLASH_RESET_MS = 600;

function useScoreAnimation(value: number): number {
  const [displayValue, setDisplayValue] = useState(value);
  const animRef = useRef<number | null>(null);
  const displayRef = useRef(value);

  useEffect(() => {
    const start = displayRef.current;
    const end = value;
    if (Math.abs(start - end) < SCORE_DIFF_THRESHOLD) return;

    const startTime = performance.now();
    if (animRef.current) cancelAnimationFrame(animRef.current);

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / SCORE_ANIM_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, EASING_EXPONENT);
      const next = start + (end - start) * eased;
      displayRef.current = next;
      setDisplayValue(next);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value]);

  return displayValue;
}

function useFlashClass(
  flashDirection: "up" | "down" | null
): { flashKey: number; flashClass: string } {
  const [flashKey, setFlashKey] = useState(0);
  const [flashClass, setFlashClass] = useState("");
  const [prevFlash, setPrevFlash] = useState<"up" | "down" | null>(null);

  if (flashDirection !== prevFlash) {
    setPrevFlash(flashDirection);
    if (flashDirection) {
      setFlashKey((k) => k + 1);
      setFlashClass(
        flashDirection === "up" ? "animate-score-up" : "animate-score-down"
      );
    }
  }

  useEffect(() => {
    if (!flashClass) return;
    const timeout = setTimeout(() => setFlashClass(""), FLASH_RESET_MS);
    return () => clearTimeout(timeout);
  }, [flashClass]);

  return { flashKey, flashClass };
}

function AnimatedScore({
  value,
  flashDirection,
}: {
  value: number;
  flashDirection: "up" | "down" | null;
}): React.JSX.Element {
  const displayValue = useScoreAnimation(value);
  const { flashKey, flashClass } = useFlashClass(flashDirection);

  return (
    <span
      key={flashKey}
      className={cn(
        "font-mono tabular-nums text-xs font-semibold text-foreground transition-colors",
        flashClass
      )}
    >
      {displayValue.toFixed(SCORE_DISPLAY_DECIMALS)}
    </span>
  );
}

export { AnimatedScore };
