import type { ScoredJob } from "@/lib/scoring";

export interface RowData {
  scored: ScoredJob;
  globalIdx: number;
  isHidden: boolean;
  isSelected: boolean;
  isDetailOpen: boolean;
  isPinned: boolean;
  isLocked: boolean;
  flashDirection: "up" | "down" | null;
  rankDelta: number | null;
}
