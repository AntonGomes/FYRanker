import type { ScoredJob } from "@/lib/scoring";
import type { Job, PlacementEntry } from "@/lib/parse-xlsx";

export interface ListRowProps {
  scored: ScoredJob;
  rank: number;
  isSelected: boolean;
  isPinned: boolean;
  isLocked: boolean;
  isDetailOpen: boolean;
  isMobile?: boolean;
  onSelectDetail: (job: Job) => void;
  onToggleSelect: (jobId: string) => void;
  onTogglePin: (jobId: string) => void;
  onToggleLock: (jobId: string) => void;
  onBoost: (jobId: string) => void;
  onBury: (jobId: string) => void;
  onMoveToOpen: (jobId: string, rank: number) => void;
  flashDirection: "up" | "down" | null;
  glowKey: number;
  rankDelta: number | null;
}

export interface RegionStyle {
  color: string;
  bg: string;
  text: string;
  border: string;
}

export interface MobileContentProps {
  scored: ScoredJob;
  rank: number;
  flashDirection: "up" | "down" | null;
  rankDelta: number | null;
  regionStyle: RegionStyle;
  score: number;
  fy1: PlacementEntry[];
  fy2: PlacementEntry[];
  washClass: string;
  swipeX: number;
  pendingAction: "boost" | "bury" | null;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export interface DesktopContentProps {
  scored: ScoredJob;
  rank: number;
  isPinned: boolean;
  isLocked: boolean;
  isSelected: boolean;
  flashDirection: "up" | "down" | null;
  rankDelta: number | null;
  regionStyle: RegionStyle;
  score: number;
  allPlacements: (PlacementEntry | null)[];
  onBoost: (jobId: string) => void;
  onBury: (jobId: string) => void;
  onMoveToOpen: (jobId: string, rank: number) => void;
  onTogglePin: (jobId: string) => void;
  onToggleLock: (jobId: string) => void;
  onToggleSelect: (jobId: string) => void;
}
