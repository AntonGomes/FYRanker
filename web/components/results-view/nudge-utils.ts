import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore } from "@/lib/scoring";
import type { GhostData, CascadeGhostData } from "@/components/results-view/types";
import {
  ROW_HEIGHT_DESKTOP,
  ROW_HEIGHT_MOBILE,
  CASCADE_STAGGER_FAST,
  CASCADE_STAGGER_SLOW,
  CASCADE_THRESHOLD,
} from "@/components/results-view/constants";

export interface LaunchGhostOpts {
  jobId: string;
  direction: "up" | "down";
  scored: ScoredJob;
  oldRank: number;
  fromRect: DOMRect;
  newIdx: number;
  scrollEl: HTMLDivElement;
  isMobile: boolean;
  ghostIdCounter: { current: number };
}

interface GhostResult {
  ghostKey: string;
  data: GhostData;
  edgeGlow: { side: "top" | "bottom"; color: "green" | "red" } | null;
}

function computeTargetY(opts: {
  newOffset: number;
  estRowH: number;
  viewTop: number;
  viewBottom: number;
  scrollRect: DOMRect;
  fromHeight: number;
}): number {
  const { newOffset, estRowH, viewTop, viewBottom, scrollRect, fromHeight } = opts;
  if (newOffset + estRowH <= viewTop) {
    return scrollRect.top - fromHeight / 2;
  }
  if (newOffset >= viewBottom) {
    return scrollRect.bottom - fromHeight / 2;
  }
  return scrollRect.top + newOffset - viewTop;
}

export function computeGhostData(opts: LaunchGhostOpts): GhostResult {
  const { direction, scored, oldRank, fromRect, newIdx, scrollEl, isMobile, ghostIdCounter } = opts;
  const scrollRect = scrollEl.getBoundingClientRect();
  const estRowH = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;
  const newOffset = newIdx * estRowH;
  const viewTop = scrollEl.scrollTop;
  const viewBottom = viewTop + scrollEl.clientHeight;
  const offScreen = newOffset + estRowH <= viewTop || newOffset >= viewBottom;

  const targetY = computeTargetY({ newOffset, estRowH, viewTop, viewBottom, scrollRect, fromHeight: fromRect.height });

  let edgeGlow: GhostResult["edgeGlow"] = null;
  if (offScreen) {
    edgeGlow = {
      side: direction === "up" ? "top" : "bottom",
      color: direction === "up" ? "green" : "red",
    };
  }

  return {
    ghostKey: `${opts.jobId}-${ghostIdCounter.current++}`,
    data: {
      scored, rank: oldRank,
      fromRect: { top: fromRect.top, left: fromRect.left, width: fromRect.width, height: fromRect.height },
      direction, targetY, offScreen,
    },
    edgeGlow,
  };
}

export interface CascadeGhostOpts {
  prevJobs: ScoredJob[];
  lo: number;
  hi: number;
  direction: "up" | "down";
  gapIdx: number;
  scrollEl: HTMLDivElement;
  contentEl: HTMLDivElement;
  ghostIdCounter: { current: number };
}

interface CascadeResult {
  newCascades: Map<string, CascadeGhostData>;
  hideIds: Set<string>;
}

function buildCascadeIndices(opts: {
  lo: number;
  hi: number;
  direction: "up" | "down";
}): number[] {
  const indices: number[] = [];
  if (opts.direction === "up") {
    for (let i = opts.hi; i >= opts.lo; i--) indices.push(i);
  } else {
    for (let i = opts.lo; i <= opts.hi; i++) indices.push(i);
  }
  return indices;
}

function buildRectCache(opts: {
  scrollEl: HTMLDivElement;
  prevJobs: ScoredJob[];
  lo: number;
  hi: number;
  gapIdx: number;
}): Map<number, DOMRect> {
  const { scrollEl, prevJobs, lo, hi, gapIdx } = opts;
  const cache = new Map<number, DOMRect>();
  for (let i = lo; i <= hi; i++) {
    const sj = prevJobs[i];
    if (!sj) continue;
    const el = scrollEl.querySelector(`[data-job-id="${sj.job.programmeTitle}"]`);
    if (el) cache.set(i, el.getBoundingClientRect());
  }
  const gapSj = prevJobs[gapIdx];
  if (gapSj) {
    const gapEl = scrollEl.querySelector(`[data-job-id="${gapSj.job.programmeTitle}"]`);
    if (gapEl) cache.set(gapIdx, gapEl.getBoundingClientRect());
  }
  return cache;
}

function buildOneCascadeGhost(opts: {
  idx: number;
  direction: "up" | "down";
  prevJobs: ScoredJob[];
  rectCache: Map<number, DOMRect>;
  contentRect: DOMRect;
  staggerSec: number;
  count: number;
}): CascadeGhostData | null {
  const sj = opts.prevJobs[opts.idx];
  if (!sj) return null;
  const fromRect = opts.rectCache.get(opts.idx);
  if (!fromRect) return null;

  const targetIdx = opts.direction === "up" ? opts.idx + 1 : opts.idx - 1;
  const targetRect = opts.rectCache.get(targetIdx);

  let deltaX = 0;
  let deltaY = 0;
  if (targetRect) {
    deltaX = targetRect.left - fromRect.left;
    deltaY = targetRect.top - fromRect.top;
  }
  if (deltaX === 0 && deltaY === 0 && !targetRect) return null;

  return {
    scored: sj, rank: opts.idx + 1,
    fromX: fromRect.left - opts.contentRect.left,
    fromY: fromRect.top - opts.contentRect.top,
    deltaX, deltaY,
    width: fromRect.width, height: fromRect.height,
    delay: opts.count * opts.staggerSec,
  };
}

export function computeCascadeGhosts(opts: CascadeGhostOpts): CascadeResult {
  const { prevJobs, lo, hi, direction, gapIdx, scrollEl, contentEl, ghostIdCounter } = opts;
  if (lo > hi) return { newCascades: new Map(), hideIds: new Set() };

  const contentRect = contentEl.getBoundingClientRect();
  const rectCache = buildRectCache({ scrollEl, prevJobs, lo, hi, gapIdx });
  const indices = buildCascadeIndices({ lo, hi, direction });
  const totalDisplaced = hi - lo + 1;
  const staggerSec = totalDisplaced <= CASCADE_THRESHOLD ? CASCADE_STAGGER_FAST : CASCADE_STAGGER_SLOW;

  const newCascades = new Map<string, CascadeGhostData>();
  let count = 0;

  for (const idx of indices) {
    const data = buildOneCascadeGhost({ idx, direction, prevJobs, rectCache, contentRect, staggerSec, count });
    if (!data) continue;
    newCascades.set(`cascade-${prevJobs[idx].job.programmeTitle}-${ghostIdCounter.current++}`, data);
    count++;
  }

  const hideIds = new Set<string>();
  for (const [, data] of newCascades) hideIds.add(data.scored.job.programmeTitle);
  return { newCascades, hideIds };
}

export function sortByEffectiveScore(jobs: ScoredJob[]): ScoredJob[] {
  return [...jobs].sort((a, b) => effectiveScore(b) - effectiveScore(a));
}

export function applyNudgeToJob(opts: {
  jobs: ScoredJob[];
  jobId: string;
  delta: number;
}): ScoredJob[] {
  return opts.jobs.map((sj) =>
    sj.job.programmeTitle === opts.jobId
      ? { ...sj, scoreAdjustment: (sj.scoreAdjustment ?? 0) + opts.delta }
      : sj
  );
}
