"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` using requestAnimationFrame.
 * Returns the current interpolated value (integer).
 *
 * @param target   - The number to count up to
 * @param duration - Animation duration in ms (default 2000)
 * @param trigger  - Only starts animating when this becomes true
 */
export function useAnimatedCounter(
  target: number,
  duration = 2000,
  trigger = true
): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (!trigger || target === 0) return;

    startTime.current = null;

    const animate = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafId.current);
  }, [target, duration, trigger]);

  return value;
}
