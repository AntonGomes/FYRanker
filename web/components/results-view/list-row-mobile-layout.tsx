"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MobileContentProps } from "@/components/results-view/list-row-types";
import {
  MobileSwipeOverlay,
  MobilePlacementsGrid,
  MobileHeaderRow,
} from "@/components/results-view/list-row-mobile";


function MobileContent({
  scored,
  rank,
  flashDirection,
  rankDelta,
  regionStyle,
  score,
  fy1,
  fy2,
  washClass,
  swipeX,
  pendingAction,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: MobileContentProps): React.JSX.Element {
  return (
    <>
      <MobileSwipeOverlay swipeX={swipeX} pendingAction={pendingAction} />
      <motion.div
        className={cn(
          "relative flex flex-col py-2 px-2.5 bg-card rounded-xl",
          washClass
        )}
        animate={{ x: swipeX }}
        transition={
          swipeX === 0
            ? { type: "spring", stiffness: 500, damping: 30 }
            : { duration: 0 }
        }
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <MobileHeaderRow
          rank={rank}
          rankDelta={rankDelta}
          flashDirection={flashDirection}
          regionStyle={regionStyle}
          region={scored.job.region}
          title={scored.job.programmeTitle}
          score={score}
        />
        <MobilePlacementsGrid fy1={fy1} fy2={fy2} />
      </motion.div>
    </>
  );
}

export { MobileContent };
