"use client";

import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { SLIDER_TICK_POSITIONS } from "@/lib/constants";
import { TICK_LABELS, SLIDER_RANGE, SLIDER_HALF, PERCENTAGE } from "./constants";

interface DuelSliderProps {
  sliderValue: number;
  isTransitioning: boolean;
  onSliderChange: (v: number) => void;
  onSliderCommit: (v: number) => void;
}

const SLIDER_THUMB_CLASSES = cn(
  "[&_[data-slot=slider-thumb]]:size-8 sm:[&_[data-slot=slider-thumb]]:size-6",
  "[&_[data-slot=slider-thumb]]:shadow-md",
  "[&_[data-slot=slider-thumb]]:border-2",
  "[&_[data-slot=slider-thumb]]:border-primary",
  "[&_[data-slot=slider-thumb]]:bg-white dark:[&_[data-slot=slider-thumb]]:bg-white",
  "[&_[data-slot=slider-thumb]]:ring-4",
  "[&_[data-slot=slider-thumb]]:ring-primary/10",
  "[&_[data-slot=slider-thumb]]:disabled:opacity-100",
);

function ActiveFill({ sliderValue }: { sliderValue: number }) {
  if (sliderValue === 0) return null;

  const style = sliderValue < 0
    ? { left: `${((sliderValue + SLIDER_HALF) / SLIDER_RANGE) * PERCENTAGE}%`, right: "50%" }
    : { left: "50%", right: `${((SLIDER_HALF - sliderValue) / SLIDER_RANGE) * PERCENTAGE}%` };

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 h-[4px] bg-primary rounded-full pointer-events-none z-10"
      style={style}
    />
  );
}

function TickMarks() {
  return (
    <>
      {SLIDER_TICK_POSITIONS.map((pct) => (
        <div
          key={pct}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2 rounded-full bg-border z-[5]"
          style={{ left: `${pct}%` }}
        />
      ))}
    </>
  );
}

export function DuelSlider({ sliderValue, isTransitioning, onSliderChange, onSliderCommit }: DuelSliderProps) {
  return (
    <div className="pt-4 pb-1 px-1 touch-none">
      <div className="relative">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[4px] bg-border rounded-full" />
        <TickMarks />
        <ActiveFill sliderValue={sliderValue} />
        <Slider
          value={[sliderValue]}
          onValueChange={([v]) => onSliderChange(v)}
          onValueCommit={([v]) => onSliderCommit(v)}
          min={-2}
          max={2}
          step={0.01}
          disabled={isTransitioning}
          className={cn(
            "relative z-20",
            "[&_[data-slot=slider-track]]:py-3",
            "[&_[data-slot=slider-track]]:bg-transparent",
            "[&_[data-slot=slider-track]]:h-[4px]",
            "data-[disabled]:opacity-100",
            SLIDER_THUMB_CLASSES,
            "[&_[data-slot=slider-range]]:bg-transparent",
          )}
        />
      </div>
      <div className="flex justify-between mt-3 px-0.5">
        {TICK_LABELS.map((tick, i) => (
          <span
            key={i}
            className={cn(
              "text-[10px] sm:text-[11px] font-semibold leading-tight text-center",
              i === 2 ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
