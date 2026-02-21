"use client";

import type { useDuelTransition } from "./use-duel-transition";
import type { CardStyle } from "./utils";
import { DuelCard } from "./duel-card";
import { VsSeparator } from "./vs-separator";
import { DuelSlider } from "./duel-slider";

interface DuelArenaProps {
  leftSpec: string;
  rightSpec: string;
  transition: ReturnType<typeof useDuelTransition>;
  leftStyle: CardStyle | null;
  rightStyle: CardStyle | null;
  leftGlow: number;
  rightGlow: number;
}

function DuelCardPair({ leftSpec, rightSpec, t, leftStyle, rightStyle, leftGlow, rightGlow }: {
  leftSpec: string; rightSpec: string;
  t: DuelArenaProps["transition"];
  leftStyle: CardStyle | null; rightStyle: CardStyle | null;
  leftGlow: number; rightGlow: number;
}) {
  return (
    <div className="flex items-stretch gap-2 sm:gap-3 px-1 sm:px-2">
      <DuelCard
        spec={leftSpec}
        matchupKey={t.matchupKey}
        isLoser={t.winSide === "right"}
        loserFlyOff={t.loserFlyOff}
        loserEmoji={t.loserEmoji}
        isWinner={t.winSide === "left"}
        glowStyle={leftStyle}
        glowIntensity={leftGlow}
        side="left"
      />
      <VsSeparator />
      <DuelCard
        spec={rightSpec}
        matchupKey={t.matchupKey}
        isLoser={t.winSide === "left"}
        loserFlyOff={t.loserFlyOff}
        loserEmoji={t.loserEmoji}
        isWinner={t.winSide === "right"}
        glowStyle={rightStyle}
        glowIntensity={rightGlow}
        side="right"
      />
    </div>
  );
}

export function DuelArena(props: DuelArenaProps) {
  const { leftSpec, rightSpec, transition: t, leftStyle, rightStyle, leftGlow, rightGlow } = props;

  function handleSliderChange(v: number): void {
    if (!t.isTransitioning) t.setSliderValue(v);
  }

  function handleSliderCommit(v: number): void {
    if (t.isTransitioning) return;
    const snapped = Math.round(v);
    t.setSliderValue(snapped);
    t.handleComparison(snapped);
  }

  return (
    <div className="shrink-0 border-2 border-border rounded-xl bg-muted/20 dark:bg-muted/10 px-3 sm:px-5 pt-4 sm:pt-5 pb-3 overflow-visible">
      <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground text-center mb-4 uppercase tracking-wide">
        Choose your preference
      </p>
      <div className="border-b border-border/50 -mx-3 sm:-mx-5 mb-4" />
      <DuelCardPair
        leftSpec={leftSpec} rightSpec={rightSpec} t={t}
        leftStyle={leftStyle} rightStyle={rightStyle}
        leftGlow={leftGlow} rightGlow={rightGlow}
      />
      <div className="border-b border-border/50 -mx-3 sm:-mx-5 mt-4" />
      <DuelSlider
        sliderValue={t.sliderValue}
        isTransitioning={t.isTransitioning}
        onSliderChange={handleSliderChange}
        onSliderCommit={handleSliderCommit}
      />
    </div>
  );
}
