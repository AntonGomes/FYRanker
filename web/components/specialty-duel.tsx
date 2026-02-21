"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { ArrowUp } from "lucide-react";
import {
  type EloState,
  type RankingEntry,
  initElo,
  updateElo,
  selectNextMatchup,
  toRankedList,
  getFocusedNeighbourhood,
} from "@/lib/elo";
import type { SortableItem } from "@/components/sortable-list";
import { SPRING, ENTER_SPRING, EXIT_SPRING } from "@/lib/animation-presets";
import { SLIDER_TICK_POSITIONS } from "@/lib/constants";

interface SpecialtyDuelProps {
  specialties: string[];
  eloState: EloState | null;
  onStateChange: (state: EloState) => void;
  onRankingChange: (items: SortableItem[]) => void;
  movedIds?: Set<string>;
}

const TICK_LABELS = [
  { label: "Strong", sublabel: "left" },
  { label: "Slight", sublabel: "left" },
  { label: "Equal", sublabel: "" },
  { label: "Slight", sublabel: "right" },
  { label: "Strong", sublabel: "right" },
] as const;

const LOSER_EMOJIS = ["😢", "😤", "💀", "😵", "🫠", "😭"];
const CONFETTI_COLORS = [
  "#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#ef4444",
  "#facc15", "#f472b6", "#818cf8",
];


const CONFETTI_ANGLE_MIN = -140;
const CONFETTI_ANGLE_RANGE = 140;
const CONFETTI_DIST_BASE = 50;
const CONFETTI_DIST_RANGE = 70;
const CONFETTI_SIZE_BASE = 4;
const CONFETTI_SIZE_RANGE = 5;
const CONFETTI_DELAY_SCALE = 0.12;
const CONFETTI_ROTATE_RANGE = 540;
const CONFETTI_ROTATE_OFFSET = 270;
const CONFETTI_RECT_THRESHOLD = 0.4;
const CONFETTI_SCALE_END = 0.2;
const HALF = 0.5;


const DEG_HALF_CIRCLE = 180;


const GLOW_SCALE_FACTOR = 0.06;
const GLOW_RADIUS_BASE = 15;
const GLOW_RADIUS_SCALE = 50;
const GLOW_SPREAD_SCALE = 20;
const PRIMARY_L_DARK = 0.72;
const PRIMARY_L_LIGHT = 0.52;
const PRIMARY_CHROMA = 0.26;
const HUE = 300;
const L_DARK_BASE = 0.3;
const L_LIGHT_BASE = 0.92;
const BORDER_L_DARK_BASE = 0.5;
const BORDER_L_DARK_RANGE = 0.3;
const BORDER_L_LIGHT_BASE = 0.55;
const BORDER_CHROMA_BOOST = 0.05;
const GLOW_L_DARK_BASE = 0.6;
const GLOW_L_DARK_RANGE = 0.2;
const GLOW_L_LIGHT_BASE = 0.6;
const GLOW_L_LIGHT_RANGE = 0.1;
const TEXT_L_THRESHOLD = 0.6;
const TEXT_L_DARK = 0.12;
const TEXT_L_LIGHT = 0.95;
const TEXT_C_DARK = 0.02;
const TEXT_C_LIGHT = 0.01;
const PULSE_DURATION_BASE = 2;
const PULSE_DURATION_SCALE = 1.6;
const CARD_SHADOW_OPACITY_BASE = 0.2;
const CARD_SHADOW_OPACITY_SCALE = 0.5;
const INSET_SHADOW_SCALE = 35;
const CARD_SHADOW_INNER_SCALE = 0.6;
const CARD_SHADOW_OUTER_SCALE = 0.8;
const CARD_INNER_SHADOW_OPACITY_SCALE = 0.2;
const GRADIENT_L_OFFSET = 0.03;
const GRADIENT_C_OFFSET = 0.02;
const GRADIENT_H_OFFSET = 10;


const FLY_DIR_LEFT = -180;
const FLY_DIR_RIGHT = 180;
const ENTER_DIR_LEFT = -30;
const ENTER_DIR_RIGHT = 30;
const FLY_ROTATE_LEFT = -15;
const FLY_ROTATE_RIGHT = 15;


const NEIGHBOURHOOD_SIZE = 7;


const LOSER_FLY_DELAY_MS = 600;
const NEXT_MATCHUP_DELAY_MS = 1400;


const SLIDER_RANGE = 4;
const SLIDER_HALF = 2;
const PERCENTAGE = 100;


const RING_CIRCUMFERENCE = 94.25;

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function computeRanks(ratings: Map<string, number>): Map<string, number> {
  return new Map(
    Array.from(ratings.entries())
      .sort((x, y) => y[1] - x[1])
      .map(([name], i) => [name, i + 1])
  );
}

function ConfettiBurst({ count = 18 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        angle: CONFETTI_ANGLE_MIN + Math.random() * CONFETTI_ANGLE_RANGE,
        distance: CONFETTI_DIST_BASE + Math.random() * CONFETTI_DIST_RANGE,
        size: CONFETTI_SIZE_BASE + Math.random() * CONFETTI_SIZE_RANGE,
        color: randomPick(CONFETTI_COLORS),
        delay: Math.random() * CONFETTI_DELAY_SCALE,
        rotate: Math.random() * CONFETTI_ROTATE_RANGE - CONFETTI_ROTATE_OFFSET,
        shape: Math.random() > CONFETTI_RECT_THRESHOLD ? "rect" : "circle",
      })),
    [count]
  );

  return (
    <div className="absolute top-0 right-0 pointer-events-none overflow-visible z-30">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
          animate={{
            opacity: 0,
            x: Math.cos((p.angle * Math.PI) / DEG_HALF_CIRCLE) * p.distance,
            y: Math.sin((p.angle * Math.PI) / DEG_HALF_CIRCLE) * p.distance,
            scale: CONFETTI_SCALE_END,
            rotate: p.rotate,
          }}
          transition={{ duration: 0.9, delay: p.delay, ease: "easeOut" }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.shape === "rect" ? p.size * HALF : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
          }}
        />
      ))}
    </div>
  );
}

function EmojiReaction({ emoji }: { emoji: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.2, y: 10, rotate: -20 }}
      animate={{ opacity: 1, scale: 1.2, y: -12, rotate: 8 }}
      exit={{ opacity: 0, scale: 0.6, y: -40 }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 12,
        mass: 0.5,
      }}
      className="absolute -top-4 -right-1 sm:-top-5 sm:-right-1 z-30 text-3xl sm:text-4xl drop-shadow-lg select-none"
    >
      {emoji}
    </motion.div>
  );
}

function getCardStyle(intensity: number, isDark: boolean) {
  if (intensity <= 0) return {};

  const t = intensity * intensity;
  const scale = 1 + t * GLOW_SCALE_FACTOR;
  const glowRadius = GLOW_RADIUS_BASE + t * GLOW_RADIUS_SCALE;
  const glowSpread = t * GLOW_SPREAD_SCALE;

  const primaryL = isDark ? PRIMARY_L_DARK : PRIMARY_L_LIGHT;
  const primaryC = PRIMARY_CHROMA;
  const H = HUE;

  const L = isDark
    ? L_DARK_BASE + t * (primaryL - L_DARK_BASE)
    : L_LIGHT_BASE + t * (primaryL - L_LIGHT_BASE);
  const C = t * primaryC;

  const borderL = isDark ? BORDER_L_DARK_BASE + t * BORDER_L_DARK_RANGE : BORDER_L_LIGHT_BASE + t * (primaryL - BORDER_L_LIGHT_BASE);
  const borderC = t * (primaryC + BORDER_CHROMA_BOOST);
  const glowL = isDark ? GLOW_L_DARK_BASE + t * GLOW_L_DARK_RANGE : GLOW_L_LIGHT_BASE + t * GLOW_L_LIGHT_RANGE;

  const textL = L > TEXT_L_THRESHOLD ? TEXT_L_DARK : TEXT_L_LIGHT;
  const textC = L > TEXT_L_THRESHOLD ? TEXT_C_DARK : TEXT_C_LIGHT;

  const pulseDuration = PULSE_DURATION_BASE - t * PULSE_DURATION_SCALE;

  return {
    card: {
      boxShadow: [
        `0 0 ${glowRadius}px ${glowSpread}px oklch(${glowL} ${C * CARD_SHADOW_OUTER_SCALE} ${H} / ${CARD_SHADOW_OPACITY_BASE + t * CARD_SHADOW_OPACITY_SCALE})`,
        `inset 0 0 ${t * INSET_SHADOW_SCALE}px oklch(${glowL} ${C * CARD_SHADOW_INNER_SCALE} ${H} / ${t * CARD_INNER_SHADOW_OPACITY_SCALE})`,
      ].join(", "),
      borderColor: `oklch(${borderL} ${borderC} ${H})`,
      background: `linear-gradient(135deg, oklch(${L} ${C} ${H}) 0%, oklch(${L + GRADIENT_L_OFFSET} ${Math.max(0, C - GRADIENT_C_OFFSET)} ${H + GRADIENT_H_OFFSET}) 100%)`,
      transform: `scale(${scale})`,
      animation: `card-pulse ${pulseDuration}s ease-in-out infinite`,
    },
    text: {
      color: `oklch(${textL} ${textC} ${H})`,
    },
  };
}
function DuelCard({
  spec,
  matchupKey,
  isLoser,
  loserFlyOff,
  loserEmoji,
  isWinner,
  glowStyle,
  glowIntensity,
  side,
}: {
  spec: string;
  matchupKey: number;
  isLoser: boolean;
  loserFlyOff: boolean;
  loserEmoji: string | null;
  isWinner: boolean;
  glowStyle: ReturnType<typeof getCardStyle> | null;
  glowIntensity: number;
  side: "left" | "right";
}) {
  const flyDir = side === "left" ? FLY_DIR_LEFT : FLY_DIR_RIGHT;
  const enterDir = side === "left" ? ENTER_DIR_LEFT : ENTER_DIR_RIGHT;
  const flyRotate = side === "left" ? FLY_ROTATE_LEFT : FLY_ROTATE_RIGHT;

  return (
    <motion.div
      key={`${side}-${matchupKey}`}
      initial={{ opacity: 0, x: enterDir, scale: 0.95 }}
      animate={
        isLoser && loserFlyOff
          ? { opacity: 0, x: flyDir, scale: 0.7, rotate: flyRotate }
          : { opacity: 1, x: 0, scale: 1, rotate: 0 }
      }
      transition={isLoser && loserFlyOff ? EXIT_SPRING : ENTER_SPRING}
      className={cn(
        "relative flex-1 min-w-0 min-h-[80px] sm:min-h-[100px] rounded-2xl border-2 bg-card text-foreground shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.06] p-3 sm:p-5 flex items-center justify-center",
        "transition-[background,border-color,box-shadow,transform] duration-150 ease-out",
        glowIntensity <= 0 && "border-primary/25 shadow-primary/10",
      )}
      style={glowStyle?.card}
    >
      <span
        className="text-sm sm:text-lg font-bold text-center leading-snug break-words"
        style={glowStyle?.text}
      >
        {spec}
      </span>
      {isWinner && <ConfettiBurst />}
      <AnimatePresence>
        {isLoser && loserEmoji && !loserFlyOff && (
          <EmojiReaction emoji={loserEmoji} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
function NeighbourhoodRow({
  entry,
  isInMatchup,
  trackedItem,
  loserAnnotation,
  flashDir,
  glowKey,
}: {
  entry: RankingEntry;
  isInMatchup: boolean;
  trackedItem: { id: string; delta: number } | null;
  loserAnnotation: { id: string; delta: number } | null;
  flashDir: "up" | "down" | undefined;
  glowKey: number;
}) {
  const isWinner = trackedItem?.id === entry.id;
  const isLoser = loserAnnotation?.id === entry.id;

  return (
    <motion.div
      key={entry.id}
      layoutId={`duel-rank-${entry.id}`}
      layout="position"
      transition={SPRING}
    >
      <div
        key={glowKey}
        className={cn(
          "flex items-center gap-2 rounded px-2 py-1",
          flashDir === "up" && "animate-card-glow-up-fast",
          flashDir === "down" && "animate-card-glow-down-fast",
          !flashDir && isInMatchup && "bg-primary/10 dark:bg-primary/15",
          !flashDir && !isInMatchup && "bg-muted/30"
        )}
      >
        <span className="text-xs font-mono font-bold text-muted-foreground w-5 text-right tabular-nums">
          #{entry.rank}
        </span>
        <span className={cn(
          "flex-1 text-xs sm:text-sm text-foreground truncate",
          isInMatchup ? "font-semibold" : "font-medium"
        )}>
          {entry.label}
        </span>
        {isWinner && trackedItem.delta > 0 && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            <ArrowUp className="h-2.5 w-2.5" />
            +{trackedItem.delta}
          </span>
        )}
        {isLoser && loserAnnotation.delta < 0 && (
          <span className="text-[9px] font-bold text-red-500 dark:text-red-400">
            {loserAnnotation.delta}
          </span>
        )}
      </div>
    </motion.div>
  );
}
export function SpecialtyDuel({
  specialties,
  eloState,
  onStateChange,
  onRankingChange,
  movedIds,
}: SpecialtyDuelProps) {
  const state = eloState ?? initElo(specialties);

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    setIsDark(el.classList.contains("dark"));
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const [currentMatchup, setCurrentMatchup] = useState<[string, string]>(() =>
    selectNextMatchup(state, movedIds)
  );
  const [neighbourhood, setNeighbourhood] = useState<RankingEntry[]>(() =>
    getFocusedNeighbourhood({ state, focal: currentMatchup[0], windowSize: NEIGHBOURHOOD_SIZE })
  );
  const [trackedItem, setTrackedItem] = useState<{ id: string; delta: number } | null>(null);
  const [loserAnnotation, setLoserAnnotation] = useState<{ id: string; delta: number } | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [winSide, setWinSide] = useState<"left" | "right" | null>(null);
  const [loserFlyOff, setLoserFlyOff] = useState(false);
  const [loserEmoji, setLoserEmoji] = useState<string | null>(null);
  const matchupKeyRef = useRef(0);

  const glowKeyRef = useRef<Map<string, number>>(new Map());
  const [flashMap, setFlashMap] = useState<Map<string, "up" | "down">>(new Map());

  function advanceToNextMatchup(newState: EloState): void {
    matchupKeyRef.current += 1;
    const next = selectNextMatchup(newState, movedIds);
    setCurrentMatchup(next);
    setNeighbourhood(getFocusedNeighbourhood({ state: newState, focal: next[0], windowSize: NEIGHBOURHOOD_SIZE }));
    setSliderValue(0);
  }

  function resetTransitionState(): void {
    setTrackedItem(null);
    setLoserAnnotation(null);
    setFlashMap(new Map());
    setWinSide(null);
    setLoserEmoji(null);
    setLoserFlyOff(false);
    setIsTransitioning(false);
  }

  const handleComparison = useCallback(
    (weight: number) => {
      if (isTransitioning) return;

      const [a, b] = currentMatchup;
      const ranksBefore = computeRanks(state.ratings);
      const newState = updateElo({ state, a, b, weight });
      const ranksAfter = computeRanks(newState.ratings);

      onStateChange(newState);
      onRankingChange(toRankedList(newState));

      if (weight === 0) {
        advanceToNextMatchup(newState);
        return;
      }

      const winner = weight < 0 ? a : b;
      const loser = weight < 0 ? b : a;
      const winnerDelta = (ranksBefore.get(winner) ?? 0) - (ranksAfter.get(winner) ?? 0);
      const loserDelta = (ranksBefore.get(loser) ?? 0) - (ranksAfter.get(loser) ?? 0);

      glowKeyRef.current.set(winner, (glowKeyRef.current.get(winner) ?? 0) + 1);
      glowKeyRef.current.set(loser, (glowKeyRef.current.get(loser) ?? 0) + 1);
      setFlashMap(() => {
        const next = new Map<string, "up" | "down">();
        next.set(winner, "up");
        next.set(loser, "down");
        return next;
      });

      const side = weight < 0 ? "left" : "right";
      setWinSide(side);
      setLoserEmoji(randomPick(LOSER_EMOJIS));
      setLoserFlyOff(false);
      setTrackedItem({ id: winner, delta: winnerDelta });
      setLoserAnnotation({ id: loser, delta: loserDelta });
      setNeighbourhood(getFocusedNeighbourhood({ state: newState, focal: winner, windowSize: NEIGHBOURHOOD_SIZE }));
      setIsTransitioning(true);

      setTimeout(() => setLoserFlyOff(true), LOSER_FLY_DELAY_MS);

      setTimeout(() => {
        resetTransitionState();
        advanceToNextMatchup(newState);
      }, NEXT_MATCHUP_DELAY_MS);
    },
    [currentMatchup, state, onStateChange, onRankingChange, movedIds, isTransitioning]
  );

  const [leftSpec, rightSpec] = currentMatchup;

  const leftGlow = Math.max(0, -sliderValue) / 2;
  const rightGlow = Math.max(0, sliderValue) / 2;
  const leftStyle = leftGlow > 0 ? getCardStyle(leftGlow, isDark) : null;
  const rightStyle = rightGlow > 0 ? getCardStyle(rightGlow, isDark) : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 justify-evenly gap-2">
      <div className="shrink-0 max-h-[160px] sm:max-h-[180px] overflow-hidden px-1">
        <div className="bg-muted/40 dark:bg-black/20 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)] border border-border/30 rounded-xl pointer-events-none p-2">
          <LayoutGroup>
            <div className="space-y-0.5">
              <AnimatePresence mode="popLayout">
                {neighbourhood.map((entry) => (
                  <NeighbourhoodRow
                    key={entry.id}
                    entry={entry}
                    isInMatchup={entry.id === leftSpec || entry.id === rightSpec}
                    trackedItem={trackedItem}
                    loserAnnotation={loserAnnotation}
                    flashDir={flashMap.get(entry.id)}
                    glowKey={glowKeyRef.current.get(entry.id) ?? 0}
                  />
                ))}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>
      </div>

      <div className="shrink-0 border-2 border-border rounded-xl bg-muted/20 dark:bg-muted/10 px-3 sm:px-5 pt-4 sm:pt-5 pb-3 overflow-visible">
        <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground text-center mb-4 uppercase tracking-wide">Choose your preference</p>
        <div className="border-b border-border/50 -mx-3 sm:-mx-5 mb-4" />
        <div className="flex items-stretch gap-2 sm:gap-3 px-1 sm:px-2">
          <DuelCard
            spec={leftSpec}
            matchupKey={matchupKeyRef.current}
            isLoser={winSide === "right"}
            loserFlyOff={loserFlyOff}
            loserEmoji={loserEmoji}
            isWinner={winSide === "left"}
            glowStyle={leftStyle}
            glowIntensity={leftGlow}
            side="left"
          />

          <div className="flex items-center shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 sm:w-4 h-px bg-border" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/60 px-1.5 sm:px-2 py-0.5 rounded-full border border-border/50">
                vs
              </span>
              <div className="w-3 sm:w-4 h-px bg-border" />
            </div>
          </div>

          <DuelCard
            spec={rightSpec}
            matchupKey={matchupKeyRef.current}
            isLoser={winSide === "left"}
            loserFlyOff={loserFlyOff}
            loserEmoji={loserEmoji}
            isWinner={winSide === "right"}
            glowStyle={rightStyle}
            glowIntensity={rightGlow}
            side="right"
          />
        </div>

        <div className="border-b border-border/50 -mx-3 sm:-mx-5 mt-4" />

        <div className="pt-4 pb-1 px-1 touch-none">
        <div className="relative">
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[4px] bg-border rounded-full" />
          {SLIDER_TICK_POSITIONS.map((pct) => (
            <div
              key={pct}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2 rounded-full bg-border z-[5]"
              style={{ left: `${pct}%` }}
            />
          ))}
          {sliderValue !== 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[4px] bg-primary rounded-full pointer-events-none z-10"
              style={
                sliderValue < 0
                  ? { left: `${((sliderValue + SLIDER_HALF) / SLIDER_RANGE) * PERCENTAGE}%`, right: "50%" }
                  : { left: "50%", right: `${((SLIDER_HALF - sliderValue) / SLIDER_RANGE) * PERCENTAGE}%` }
              }
            />
          )}
          <Slider
            value={[sliderValue]}
            onValueChange={([v]) => {
              if (!isTransitioning) setSliderValue(v);
            }}
            onValueCommit={([v]) => {
              if (isTransitioning) return;
              const snapped = Math.round(v);
              setSliderValue(snapped);
              handleComparison(snapped);
            }}
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
              "[&_[data-slot=slider-thumb]]:size-8 sm:[&_[data-slot=slider-thumb]]:size-6",
              "[&_[data-slot=slider-thumb]]:shadow-md",
              "[&_[data-slot=slider-thumb]]:border-2",
              "[&_[data-slot=slider-thumb]]:border-primary",
              "[&_[data-slot=slider-thumb]]:bg-white dark:[&_[data-slot=slider-thumb]]:bg-white",
              "[&_[data-slot=slider-thumb]]:ring-4",
              "[&_[data-slot=slider-thumb]]:ring-primary/10",
              "[&_[data-slot=slider-thumb]]:disabled:opacity-100",
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
      </div>
    </div>
  );
}
