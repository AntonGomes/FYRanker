"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  closestCenter,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScoredJob } from "@/lib/scoring";
import { MOBILE_BREAKPOINT } from "@/lib/constants";
import type { RowData } from "@/components/results-view/row-data";
import {
  SAVE_DEBOUNCE_MS,
  EDGE_GLOW_DURATION_MS,
} from "@/components/results-view/constants";
import type { NudgeAnimReturn } from "@/hooks/use-nudge-animation";
import type { BulkActionsReturn } from "@/hooks/use-bulk-actions";

export function useMobileDetect(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function update() { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isMobile;
}

export function useSaveToStorage(rankedJobs: ScoredJob[]): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const json = JSON.stringify(rankedJobs);
        localStorage.setItem("fy_scored_jobs", json);
        sessionStorage.setItem("fy_scored_jobs", json);
      } catch { }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rankedJobs]);
}

export function useEdgeGlowTimer(
  edgeGlow: { side: "top" | "bottom"; color: "green" | "red" } | null,
  setEdgeGlow: (v: null) => void
): void {
  useEffect(() => {
    if (!edgeGlow) return;
    const t = setTimeout(() => setEdgeGlow(null), EDGE_GLOW_DURATION_MS);
    return () => clearTimeout(t);
  }, [edgeGlow, setEdgeGlow]);
}

export function useResultsRefs() {
  return {
    scrollRef: useRef<HTMLDivElement>(null),
    contentRef: useRef<HTMLDivElement>(null),
    importFileRef: useRef<HTMLInputElement>(null),
    scrollToJobIdRef: useRef<string | null>(null),
  };
}

export function useUIState() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveToState, setMoveToState] = useState<{ jobId: string; rank: number } | null>(null);
  const [bulkMoveToOpen, setBulkMoveToOpen] = useState(false);
  const [scrollDir, setScrollDir] = useState<"down" | "up">("down");
  const lastScrollTop = useRef(0);
  const [showHelp, setShowHelp] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<import("@/lib/parse-xlsx").Job | null>(null);
  return {
    activeId, setActiveId, moveToState, setMoveToState,
    bulkMoveToOpen, setBulkMoveToOpen, scrollDir, setScrollDir,
    lastScrollTop, showHelp, setShowHelp, mobileSearchOpen,
    setMobileSearchOpen, mobileFiltersOpen, setMobileFiltersOpen,
    selectedDetail, setSelectedDetail,
  };
}

export function useCustomCollision(
  virtualizer: { getVirtualItems: () => Array<{ index: number }> },
  filteredJobs: ScoredJob[]
): CollisionDetection {
  return useCallback(
    (args) => {
      const vis = new Set<string>();
      virtualizer.getVirtualItems().forEach((v) => { vis.add(filteredJobs[v.index]?.job.programmeTitle); });
      const f = args.droppableContainers.filter((dc) => vis.has(dc.id as string));
      return f.length === 0 ? closestCenter(args) : closestCenter({ ...args, droppableContainers: f });
    },
    [virtualizer, filteredJobs]
  );
}

export function useRowDataGetter(opts: {
  filteredJobs: ScoredJob[];
  indexById: Map<string, number>;
  nudgeAnim: NudgeAnimReturn;
  bulk: BulkActionsReturn;
}): (jobIndex: number) => RowData | null {
  const { filteredJobs, indexById, nudgeAnim, bulk } = opts;
  return useCallback(
    (jobIndex: number) => {
      const s = filteredJobs[jobIndex];
      if (!s) return null;
      const id = s.job.programmeTitle;
      return {
        scored: s, globalIdx: indexById.get(id) ?? 0,
        isHidden: nudgeAnim.hiddenJobIds.has(id),
        isSelected: bulk.selectedIds.has(id), isDetailOpen: false,
        isPinned: bulk.pinnedJobIds.has(id), isLocked: bulk.lockedJobIds.has(id),
        flashDirection: nudgeAnim.flashMap.get(id) ?? null,
        rankDelta: nudgeAnim.rankDeltaRef.current.get(id) ?? null,
      };
    },
    [filteredJobs, indexById, nudgeAnim.hiddenJobIds, bulk.selectedIds, bulk.pinnedJobIds, bulk.lockedJobIds, nudgeAnim.flashMap, nudgeAnim.rankDeltaRef]
  );
}

export function buildIndexById(rankedJobs: ScoredJob[]): Map<string, number> {
  const map = new Map<string, number>();
  rankedJobs.forEach((s, i) => map.set(s.job.programmeTitle, i));
  return map;
}

export function computePinnedIndices(
  filteredJobs: ScoredJob[],
  pinnedJobIds: Set<string>
): number[] {
  const rows: number[] = [];
  filteredJobs.forEach((sj, i) => { if (pinnedJobIds.has(sj.job.programmeTitle)) rows.push(i); });
  return rows;
}
