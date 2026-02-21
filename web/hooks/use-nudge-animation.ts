import { useState, useCallback, useRef } from "react";
import type { ScoredJob } from "@/lib/scoring";
import type {
  GhostData,
  CascadeGhostData,
} from "@/components/results-view/types";
import {
  computeGhostData,
  computeCascadeGhosts,
  sortByEffectiveScore,
  applyNudgeToJob,
} from "@/components/results-view/nudge-utils";
import {
  FLASH_DURATION_MS,
  SAFETY_TIMEOUT_MS,
} from "@/components/results-view/constants";

export interface NudgeRefs {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  isMobile: boolean;
}

type EdgeGlow = { side: "top" | "bottom"; color: "green" | "red" } | null;
type PushFn = (updater: (prev: ScoredJob[]) => ScoredJob[]) => void;
type PendingSort = { sorted: ScoredJob[]; nudgedJobId: string; timeoutId: ReturnType<typeof setTimeout> };

export interface NudgeOpts {
  jobId: string;
  direction: "up" | "down";
  rankedJobs: ScoredJob[];
  nudgeAmount: number;
  lockedJobIds: Set<string>;
  pushAndSetRanked: PushFn;
  refs: NudgeRefs;
}

export interface NudgeAnimReturn {
  ghosts: Map<string, GhostData>;
  cascadeGhosts: Map<string, CascadeGhostData>;
  hiddenJobIds: Set<string>;
  flashMap: Map<string, "up" | "down">;
  edgeGlow: EdgeGlow;
  rankDeltaRef: React.RefObject<Map<string, number>>;
  setGhosts: React.Dispatch<React.SetStateAction<Map<string, GhostData>>>;
  setFlashMap: React.Dispatch<React.SetStateAction<Map<string, "up" | "down">>>;
  setEdgeGlow: React.Dispatch<React.SetStateAction<EdgeGlow>>;
  applyPendingSort: () => void;
  handleNudge: (opts: NudgeOpts) => void;
}

export function useNudgeAnimation(): NudgeAnimReturn {
  const [ghosts, setGhosts] = useState<Map<string, GhostData>>(new Map());
  const [cascadeGhosts, setCascadeGhosts] = useState<Map<string, CascadeGhostData>>(new Map());
  const [hiddenJobIds, setHiddenJobIds] = useState<Set<string>>(new Set());
  const [flashMap, setFlashMap] = useState<Map<string, "up" | "down">>(new Map());
  const [edgeGlow, setEdgeGlow] = useState<EdgeGlow>(null);
  const rankDeltaRef = useRef<Map<string, number>>(new Map());
  const ghostIdCounter = useRef(0);
  const pendingSortRef = useRef<PendingSort | null>(null);
  const pushRef = useRef<PushFn | null>(null);
  const clearAnim = useCallback(() => { setHiddenJobIds(new Set()); setGhosts(new Map()); setCascadeGhosts(new Map()); }, []);
  const applyPendingSort = useCallback(() => {
    const pending = pendingSortRef.current;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    if (pushRef.current) pushRef.current(() => pending.sorted);
    clearAnim();
    pendingSortRef.current = null;
  }, [clearAnim]);
  const handleNudge = useCallback(
    (opts: NudgeOpts) => doNudge({ opts, clearAnim, applyPendingSort, pushRef, pendingSortRef, ghostIdCounter, rankDeltaRef, setFlashMap, setHiddenJobIds, setEdgeGlow, setGhosts, setCascadeGhosts }),
    [clearAnim, applyPendingSort]
  );
  return { ghosts, cascadeGhosts, hiddenJobIds, flashMap, edgeGlow, rankDeltaRef, setGhosts, setFlashMap, setEdgeGlow, applyPendingSort, handleNudge };
}

interface DoNudgeCtx {
  opts: NudgeOpts;
  clearAnim: () => void;
  applyPendingSort: () => void;
  pushRef: React.MutableRefObject<PushFn | null>;
  pendingSortRef: React.MutableRefObject<PendingSort | null>;
  ghostIdCounter: React.MutableRefObject<number>;
  rankDeltaRef: React.RefObject<Map<string, number>>;
  setFlashMap: React.Dispatch<React.SetStateAction<Map<string, "up" | "down">>>;
  setHiddenJobIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEdgeGlow: React.Dispatch<React.SetStateAction<EdgeGlow>>;
  setGhosts: React.Dispatch<React.SetStateAction<Map<string, GhostData>>>;
  setCascadeGhosts: React.Dispatch<React.SetStateAction<Map<string, CascadeGhostData>>>;
}

function flushPending(ctx: DoNudgeCtx): void {
  if (!ctx.pendingSortRef.current) return;
  clearTimeout(ctx.pendingSortRef.current.timeoutId);
  ctx.opts.pushAndSetRanked(() => ctx.pendingSortRef.current!.sorted);
  ctx.clearAnim();
  ctx.pendingSortRef.current = null;
}

function setFlash(ctx: DoNudgeCtx): void {
  ctx.rankDeltaRef.current.set(ctx.opts.jobId, 0);
  ctx.setFlashMap((p) => new Map(p).set(ctx.opts.jobId, ctx.opts.direction));
  setTimeout(() => {
    ctx.setFlashMap((p) => { const n = new Map(p); n.delete(ctx.opts.jobId); return n; });
    ctx.rankDeltaRef.current.delete(ctx.opts.jobId);
  }, FLASH_DURATION_MS);
}

function doNudge(ctx: DoNudgeCtx): void {
  const { opts } = ctx;
  if (opts.lockedJobIds.has(opts.jobId)) return;
  ctx.pushRef.current = opts.pushAndSetRanked;
  flushPending(ctx);
  const sign = opts.direction === "up" ? 1 : -1;
  const oldIdx = opts.rankedJobs.findIndex((sj) => sj.job.programmeTitle === opts.jobId);
  if (oldIdx === -1) return;
  const updated = applyNudgeToJob({ jobs: opts.rankedJobs, jobId: opts.jobId, delta: sign * opts.nudgeAmount });
  const sorted = sortByEffectiveScore(updated);
  const newIdx = sorted.findIndex((sj) => sj.job.programmeTitle === opts.jobId);
  if (oldIdx === newIdx) { opts.pushAndSetRanked(() => sorted); return; }
  ctx.rankDeltaRef.current.set(opts.jobId, oldIdx - newIdx);
  setFlash(ctx);
  ctx.setHiddenJobIds(new Set([opts.jobId]));
  launchNudgeGhost({ jobId: opts.jobId, direction: opts.direction, scored: opts.rankedJobs[oldIdx], oldIdx, newIdx, refs: opts.refs, ghostIdCounter: ctx.ghostIdCounter, setEdgeGlow: ctx.setEdgeGlow, setGhosts: ctx.setGhosts });
  launchNudgeCascades({ prevJobs: opts.rankedJobs, oldIdx, newIdx, direction: opts.direction, refs: opts.refs, ghostIdCounter: ctx.ghostIdCounter, setHiddenJobIds: ctx.setHiddenJobIds, setCascadeGhosts: ctx.setCascadeGhosts });
  const tid = setTimeout(() => ctx.applyPendingSort(), SAFETY_TIMEOUT_MS);
  ctx.pendingSortRef.current = { sorted, nudgedJobId: opts.jobId, timeoutId: tid };
}

function launchNudgeGhost(opts: {
  jobId: string;
  direction: "up" | "down";
  scored: ScoredJob;
  oldIdx: number;
  newIdx: number;
  refs: NudgeRefs;
  ghostIdCounter: React.MutableRefObject<number>;
  setEdgeGlow: React.Dispatch<React.SetStateAction<EdgeGlow>>;
  setGhosts: React.Dispatch<React.SetStateAction<Map<string, GhostData>>>;
}): void {
  const el = opts.refs.scrollRef.current?.querySelector(`[data-job-id="${opts.jobId}"]`);
  const fromRect = el?.getBoundingClientRect();
  if (!fromRect || !opts.refs.scrollRef.current) return;
  const result = computeGhostData({
    jobId: opts.jobId, direction: opts.direction, scored: opts.scored,
    oldRank: opts.oldIdx + 1, fromRect, newIdx: opts.newIdx,
    scrollEl: opts.refs.scrollRef.current, isMobile: opts.refs.isMobile,
    ghostIdCounter: opts.ghostIdCounter,
  });
  if (result.edgeGlow) opts.setEdgeGlow(result.edgeGlow);
  opts.setGhosts((prev) => new Map(prev).set(result.ghostKey, result.data));
}

function launchNudgeCascades(opts: {
  prevJobs: ScoredJob[];
  oldIdx: number;
  newIdx: number;
  direction: "up" | "down";
  refs: NudgeRefs;
  ghostIdCounter: React.MutableRefObject<number>;
  setHiddenJobIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCascadeGhosts: React.Dispatch<React.SetStateAction<Map<string, CascadeGhostData>>>;
}): void {
  const scrollEl = opts.refs.scrollRef.current;
  const contentEl = opts.refs.contentRef.current;
  if (!scrollEl || !contentEl) return;
  const [lo, hi] = opts.direction === "up" ? [opts.newIdx, opts.oldIdx - 1] : [opts.oldIdx + 1, opts.newIdx];
  const { newCascades, hideIds } = computeCascadeGhosts({
    prevJobs: opts.prevJobs, lo, hi, direction: opts.direction,
    gapIdx: opts.oldIdx, scrollEl, contentEl, ghostIdCounter: opts.ghostIdCounter,
  });
  if (newCascades.size > 0) {
    opts.setHiddenJobIds((prev) => { const n = new Set(prev); for (const id of hideIds) n.add(id); return n; });
    opts.setCascadeGhosts((prev) => { const n = new Map(prev); for (const [k, v] of newCascades) n.set(k, v); return n; });
  }
}
