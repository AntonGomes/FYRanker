"use client";

import { LayoutGroup, AnimatePresence } from "framer-motion";
import type { RankingEntry } from "@/lib/elo";
import { NeighbourhoodRow, type DeltaAnnotation } from "./neighbourhood-row";

interface NeighbourhoodPanelProps {
  neighbourhood: RankingEntry[];
  leftSpec: string;
  rightSpec: string;
  trackedItem: DeltaAnnotation | null;
  loserAnnotation: DeltaAnnotation | null;
  flashMap: Map<string, "up" | "down">;
  glowKeyMap: Map<string, number>;
}

export function NeighbourhoodPanel(props: NeighbourhoodPanelProps) {
  const { neighbourhood, leftSpec, rightSpec, trackedItem, loserAnnotation, flashMap, glowKeyMap } = props;

  return (
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
                  glowKey={glowKeyMap.get(entry.id) ?? 0}
                />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
}
