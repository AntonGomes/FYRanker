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
  getConfidence,
  toRankedList,
  getFocusedNeighbourhood,
} from "@/lib/elo";
import type { SortableItem } from "@/components/sortable-list";

interface SpecialtyDuelProps {
  specialties: string[];
  eloState: EloState | null;
  onStateChange: (state: EloState) => void;
  onRankingChange: (items: SortableItem[]) => void;
  movedIds?: Set<string>;
}

const SPRING = { type: "spring" as const, stiffness: 500, damping: 35, mass: 0.8 };

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

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Confetti burst from top-right corner of card */
function ConfettiBurst({ count = 18 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        // Spread in an arc from top-right corner, mostly upward and outward
        angle: -140 + Math.random() * 140,
        distance: 50 + Math.random() * 70,
        size: 4 + Math.random() * 5,
        color: randomPick(CONFETTI_COLORS),
        delay: Math.random() * 0.12,
        rotate: Math.random() * 540 - 270,
        shape: Math.random() > 0.4 ? "rect" : "circle",
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
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            scale: 0.2,
            rotate: p.rotate,
          }}
          transition={{ duration: 0.9, delay: p.delay, ease: "easeOut" }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.shape === "rect" ? p.size * 0.5 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
          }}
        />
      ))}
    </div>
  );
}

/** Emoji reaction that floats up like iMessage — pops in, hangs, then fades */
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

/**
 * Compute dramatic "going super saiyan" card styles.
 * Progression: dark purple → hot pink → blazing white
 * Works in both light and dark mode.
 */
function getCardStyle(intensity: number, isDark: boolean) {
  if (intensity <= 0) return {};

  const t = intensity * intensity; // quadratic for explosive feel
  const scale = 1 + t * 0.06;
  const glowRadius = 15 + t * 50;
  const glowSpread = t * 20;

  // Colour journey: subtle purple → primary pink (oklch 0.52/0.72 0.26 300)
  // At max intensity, converge to the primary colour
  const primaryL = isDark ? 0.72 : 0.52;
  const primaryC = 0.26;
  const H = 300;

  // Background blends from card base toward primary
  const L = isDark
    ? 0.3 + t * (primaryL - 0.3)       // dark: 0.3 → 0.72
    : 0.92 + t * (primaryL - 0.92);     // light: 0.92 → 0.52
  const C = t * primaryC;               // 0 → 0.26

  const borderL = isDark ? 0.5 + t * 0.3 : 0.55 + t * (primaryL - 0.55);
  const borderC = t * (primaryC + 0.05);
  const glowL = isDark ? 0.6 + t * 0.2 : 0.6 + t * 0.1;

  // Text: ensure readability — dark on light bg, light on dark bg
  const textL = L > 0.6 ? 0.12 : 0.95;
  const textC = L > 0.6 ? 0.02 : 0.01;

  // Pulse speed: slows from 2s (low) → 0.4s (max) as slider moves
  const pulseDuration = 2 - t * 1.6;

  return {
    card: {
      boxShadow: [
        `0 0 ${glowRadius}px ${glowSpread}px oklch(${glowL} ${C * 0.8} ${H} / ${0.2 + t * 0.5})`,
        `inset 0 0 ${t * 35}px oklch(${glowL} ${C * 0.6} ${H} / ${t * 0.2})`,
      ].join(", "),
      borderColor: `oklch(${borderL} ${borderC} ${H})`,
      background: `linear-gradient(135deg, oklch(${L} ${C} ${H}) 0%, oklch(${L + 0.03} ${Math.max(0, C - 0.02)} ${H + 10}) 100%)`,
      transform: `scale(${scale})`,
      animation: `card-pulse ${pulseDuration}s ease-in-out infinite`,
    },
    text: {
      color: `oklch(${textL} ${textC} ${H})`,
    },
  };
}

export function SpecialtyDuel({
  specialties,
  eloState,
  onStateChange,
  onRankingChange,
  movedIds,
}: SpecialtyDuelProps) {
  const state = eloState ?? initElo(specialties);

  // Track dark mode for inline styles
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
    getFocusedNeighbourhood(state, currentMatchup[0], 7)
  );
  const [trackedItem, setTrackedItem] = useState<{ id: string; delta: number } | null>(null);
  const [loserAnnotation, setLoserAnnotation] = useState<{ id: string; delta: number } | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Which side won: "left" | "right" | null — drives confetti + loser fly-off
  const [winSide, setWinSide] = useState<"left" | "right" | null>(null);
  // Loser flies off after a delay so emoji has time to show
  const [loserFlyOff, setLoserFlyOff] = useState(false);
  const [loserEmoji, setLoserEmoji] = useState<string | null>(null);
  const matchupKeyRef = useRef(0);

  // Glow animation tracking (same pattern as results-view.tsx)
  const glowKeyRef = useRef<Map<string, number>>(new Map());
  const [flashMap, setFlashMap] = useState<Map<string, "up" | "down">>(new Map());

  const confidence = useMemo(
    () => getConfidence(state, movedIds?.size),
    [state, movedIds?.size]
  );

  const handleComparison = useCallback(
    (weight: number) => {
      if (isTransitioning) return;

      const [a, b] = currentMatchup;

      // Snapshot ranks before update
      const sortedBefore = Array.from(state.ratings.entries())
        .sort((x, y) => y[1] - x[1])
        .map(([name], i) => [name, i + 1] as const);
      const ranksBefore = new Map(sortedBefore);

      // Update ELO
      const newState = updateElo(state, a, b, weight);

      // Compute ranks after
      const sortedAfter = Array.from(newState.ratings.entries())
        .sort((x, y) => y[1] - x[1])
        .map(([name], i) => [name, i + 1] as const);
      const ranksAfter = new Map(sortedAfter);

      onStateChange(newState);
      onRankingChange(toRankedList(newState));

      // Equal → no winner/loser, advance immediately
      if (weight === 0) {
        matchupKeyRef.current += 1;
        const next = selectNextMatchup(newState, movedIds);
        setCurrentMatchup(next);
        setNeighbourhood(getFocusedNeighbourhood(newState, next[0], 7));
        setSliderValue(0);
        return;
      }

      // Determine winner/loser
      const winner = weight < 0 ? a : b;
      const loser = weight < 0 ? b : a;

      const winnerRankBefore = ranksBefore.get(winner) ?? 0;
      const winnerRankAfter = ranksAfter.get(winner) ?? 0;
      const winnerDelta = winnerRankBefore - winnerRankAfter;

      const loserRankBefore = ranksBefore.get(loser) ?? 0;
      const loserRankAfter = ranksAfter.get(loser) ?? 0;
      const loserDelta = loserRankBefore - loserRankAfter;

      // Increment glow keys for winner/loser to retrigger CSS animations
      glowKeyRef.current.set(winner, (glowKeyRef.current.get(winner) ?? 0) + 1);
      glowKeyRef.current.set(loser, (glowKeyRef.current.get(loser) ?? 0) + 1);
      setFlashMap(() => {
        const next = new Map<string, "up" | "down">();
        next.set(winner, "up");
        next.set(loser, "down");
        return next;
      });

      // Phase 1: Show confetti + emoji reaction (no fly-off yet)
      const side = weight < 0 ? "left" : "right";
      setWinSide(side);
      setLoserEmoji(randomPick(LOSER_EMOJIS));
      setLoserFlyOff(false);

      setTrackedItem({ id: winner, delta: winnerDelta });
      setLoserAnnotation({ id: loser, delta: loserDelta });
      setNeighbourhood(getFocusedNeighbourhood(newState, winner, 7));
      setIsTransitioning(true);

      // Phase 2: After emoji has shown, fly the loser off
      setTimeout(() => {
        setLoserFlyOff(true);
      }, 600);

      // Phase 3: Reset and load next matchup
      setTimeout(() => {
        setTrackedItem(null);
        setLoserAnnotation(null);
        setFlashMap(new Map());
        setWinSide(null);
        setLoserEmoji(null);
        setLoserFlyOff(false);
        matchupKeyRef.current += 1;
        const next = selectNextMatchup(newState, movedIds);
        setCurrentMatchup(next);
        setNeighbourhood(getFocusedNeighbourhood(newState, next[0], 7));
        setSliderValue(0);
        setIsTransitioning(false);
      }, 1400);
    },
    [currentMatchup, state, onStateChange, onRankingChange, movedIds, isTransitioning]
  );

  const [leftSpec, rightSpec] = currentMatchup;

  // Compute card glow intensity from slider value (0..1)
  const leftGlow = Math.max(0, -sliderValue) / 2;
  const rightGlow = Math.max(0, sliderValue) / 2;
  const leftStyle = leftGlow > 0 ? getCardStyle(leftGlow, isDark) : null;
  const rightStyle = rightGlow > 0 ? getCardStyle(rightGlow, isDark) : null;

  // Determine loser animation state for each card
  const leftIsLoser = winSide === "right";
  const rightIsLoser = winSide === "left";

  return (
    <div className="flex flex-col flex-1 min-h-0 justify-evenly gap-2">
      {/* Ranking neighbourhood — recessed viewport */}
      <div className="shrink-0 max-h-[160px] sm:max-h-[180px] overflow-hidden px-1">
        <div className="bg-muted/40 dark:bg-black/20 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)] border border-border/30 rounded-xl pointer-events-none p-2">
          <LayoutGroup>
            <div className="space-y-0.5">
              <AnimatePresence mode="popLayout">
                {neighbourhood.map((entry) => {
                  const isWinner = trackedItem?.id === entry.id;
                  const isLoser = loserAnnotation?.id === entry.id;
                  const flashDir = flashMap.get(entry.id);
                  const glowKey = glowKeyRef.current.get(entry.id) ?? 0;
                  const isInMatchup = entry.id === leftSpec || entry.id === rightSpec;

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
                })}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>
      </div>

      {/* Matchup + slider — boxed section */}
      <div className="shrink-0 border-2 border-border rounded-xl bg-muted/20 dark:bg-muted/10 px-3 sm:px-5 pt-4 sm:pt-5 pb-3 overflow-visible">
        <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground text-center mb-4 uppercase tracking-wide">Choose your preference</p>
        <div className="border-b border-border/50 -mx-3 sm:-mx-5 mb-4" />
        <div className="flex items-stretch gap-2 sm:gap-3 px-1 sm:px-2">
          {/* Left card */}
          <motion.div
            key={`left-${matchupKeyRef.current}`}
            initial={{ opacity: 0, x: -30, scale: 0.95 }}
            animate={
              leftIsLoser && loserFlyOff
                ? { opacity: 0, x: -180, scale: 0.7, rotate: -15 }
                : { opacity: 1, x: 0, scale: 1, rotate: 0 }
            }
            transition={
              leftIsLoser && loserFlyOff
                ? { type: "spring", stiffness: 200, damping: 20 }
                : { type: "spring", stiffness: 350, damping: 28 }
            }
            className={cn(
              "relative flex-1 min-w-0 min-h-[80px] sm:min-h-[100px] rounded-2xl border-2 bg-card text-foreground shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.06] p-3 sm:p-5 flex items-center justify-center",
              "transition-[background,border-color,box-shadow,transform] duration-150 ease-out",
              leftGlow <= 0 && "border-primary/25 shadow-primary/10",
            )}
            style={leftStyle?.card}
          >
            <span
              className="text-sm sm:text-lg font-bold text-center leading-snug break-words"
              style={leftStyle?.text}
            >
              {leftSpec}
            </span>
            {winSide === "left" && <ConfettiBurst />}
            <AnimatePresence>
              {leftIsLoser && loserEmoji && !loserFlyOff && (
                <EmojiReaction emoji={loserEmoji} />
              )}
            </AnimatePresence>
          </motion.div>

          {/* Decorative VS pill */}
          <div className="flex items-center shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 sm:w-4 h-px bg-border" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/60 px-1.5 sm:px-2 py-0.5 rounded-full border border-border/50">
                vs
              </span>
              <div className="w-3 sm:w-4 h-px bg-border" />
            </div>
          </div>

          {/* Right card */}
          <motion.div
            key={`right-${matchupKeyRef.current}`}
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={
              rightIsLoser && loserFlyOff
                ? { opacity: 0, x: 180, scale: 0.7, rotate: 15 }
                : { opacity: 1, x: 0, scale: 1, rotate: 0 }
            }
            transition={
              rightIsLoser && loserFlyOff
                ? { type: "spring", stiffness: 200, damping: 20 }
                : { type: "spring", stiffness: 350, damping: 28 }
            }
            className={cn(
              "relative flex-1 min-w-0 min-h-[80px] sm:min-h-[100px] rounded-2xl border-2 bg-card text-foreground shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.06] p-3 sm:p-5 flex items-center justify-center",
              "transition-[background,border-color,box-shadow,transform] duration-150 ease-out",
              rightGlow <= 0 && "border-primary/25 shadow-primary/10",
            )}
            style={rightStyle?.card}
          >
            <span
              className="text-sm sm:text-lg font-bold text-center leading-snug break-words"
              style={rightStyle?.text}
            >
              {rightSpec}
            </span>
            {winSide === "right" && <ConfettiBurst />}
            <AnimatePresence>
              {rightIsLoser && loserEmoji && !loserFlyOff && (
                <EmojiReaction emoji={loserEmoji} />
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <div className="border-b border-border/50 -mx-3 sm:-mx-5 mt-4" />

        {/* Slider section */}
        <div className="pt-4 pb-1 px-1 touch-none">
        <div className="relative">
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[4px] bg-border rounded-full" />
          {[0, 25, 50, 75, 100].map((pct) => (
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
                  ? { left: `${((sliderValue + 2) / 4) * 100}%`, right: "50%" }
                  : { left: "50%", right: `${((2 - sliderValue) / 4) * 100}%` }
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
