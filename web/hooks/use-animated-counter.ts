"use client";

import { useEffect, useRef, useState } from "react";

const EASING_EXPONENT = 3;

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

      
      const eased = 1 - Math.pow(1 - progress, EASING_EXPONENT);
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
