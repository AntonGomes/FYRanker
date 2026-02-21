"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ENTER_SPRING, EXIT_SPRING } from "@/lib/animation-presets";
import {
  FLY_DIR_LEFT, FLY_DIR_RIGHT,
  ENTER_DIR_LEFT, ENTER_DIR_RIGHT,
  FLY_ROTATE_LEFT, FLY_ROTATE_RIGHT,
} from "./constants";
import type { CardStyle } from "./utils";
import { ConfettiBurst, EmojiReaction } from "./confetti-burst";

interface DuelCardProps {
  spec: string;
  matchupKey: number;
  isLoser: boolean;
  loserFlyOff: boolean;
  loserEmoji: string | null;
  isWinner: boolean;
  glowStyle: CardStyle | null;
  glowIntensity: number;
  side: "left" | "right";
}

function getDirections(side: "left" | "right") {
  if (side === "left") {
    return { flyDir: FLY_DIR_LEFT, enterDir: ENTER_DIR_LEFT, flyRotate: FLY_ROTATE_LEFT };
  }
  return { flyDir: FLY_DIR_RIGHT, enterDir: ENTER_DIR_RIGHT, flyRotate: FLY_ROTATE_RIGHT };
}

export function DuelCard(props: DuelCardProps) {
  const { spec, matchupKey, isLoser, loserFlyOff, loserEmoji, isWinner, glowStyle, glowIntensity, side } = props;
  const { flyDir, enterDir, flyRotate } = getDirections(side);
  const isLoserFlying = isLoser && loserFlyOff;

  return (
    <motion.div
      key={`${side}-${matchupKey}`}
      initial={{ opacity: 0, x: enterDir, scale: 0.95 }}
      animate={
        isLoserFlying
          ? { opacity: 0, x: flyDir, scale: 0.7, rotate: flyRotate }
          : { opacity: 1, x: 0, scale: 1, rotate: 0 }
      }
      transition={isLoserFlying ? EXIT_SPRING : ENTER_SPRING}
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
