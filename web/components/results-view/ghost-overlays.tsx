"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ListDragOverlayRow } from "@/components/results-view/list-row";
import type { GhostData, CascadeGhostData } from "@/components/results-view/types";
import {
  EASE_BEZIER,
  GHOST_DURATION,
  GHOST_SCALE_PEAK,
  GHOST_OPACITY_END,
  CASCADE_DURATION,
} from "@/components/results-view/constants";

interface GhostOverlayProps {
  ghosts: Map<string, GhostData>;
  isMobile: boolean;
  onAnimationComplete: (id: string) => void;
}

export function GhostOverlay(props: GhostOverlayProps): React.ReactNode {
  const { ghosts, isMobile, onAnimationComplete } = props;

  return (
    <AnimatePresence>
      {[...ghosts.entries()].map(([id, g]) => (
        <motion.div
          key={id}
          className="fixed z-50 pointer-events-none"
          style={{
            top: g.fromRect.top,
            left: g.fromRect.left,
            width: g.fromRect.width,
            height: g.fromRect.height,
          }}
          initial={{ y: 0, scale: 1, opacity: 1 }}
          animate={{
            y: g.targetY - g.fromRect.top,
            scale: [1, GHOST_SCALE_PEAK, 1],
            opacity: [1, 1, GHOST_OPACITY_END, 0],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: GHOST_DURATION, ease: EASE_BEZIER }}
          onAnimationComplete={() => onAnimationComplete(id)}
        >
          <ListDragOverlayRow
            scored={g.scored}
            rank={g.rank}
            isMobile={isMobile}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

interface CascadeGhostOverlayProps {
  cascadeGhosts: Map<string, CascadeGhostData>;
  isMobile: boolean;
}

export function CascadeGhostOverlay(
  props: CascadeGhostOverlayProps
): React.ReactNode {
  const { cascadeGhosts, isMobile } = props;

  return (
    <AnimatePresence>
      {[...cascadeGhosts.entries()].map(([id, g]) => (
        <motion.div
          key={id}
          className="absolute z-20 pointer-events-none"
          style={{
            top: g.fromY,
            left: g.fromX,
            width: g.width,
            height: g.height,
          }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: g.deltaX,
            y: g.deltaY,
            opacity: 1,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: CASCADE_DURATION,
            delay: g.delay,
            ease: EASE_BEZIER,
          }}
        >
          <ListDragOverlayRow
            scored={g.scored}
            rank={g.rank}
            isMobile={isMobile}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
