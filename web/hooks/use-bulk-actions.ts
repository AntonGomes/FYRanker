import { useState, useCallback } from "react";
import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore } from "@/lib/scoring";
import { arrayMove } from "@dnd-kit/sortable";
import type { Job } from "@/lib/parse-xlsx";
import { COMPARE_MAX_JOBS } from "@/lib/constants";
import { FLASH_DURATION_MS } from "@/components/results-view/constants";

export interface BulkActionsReturn {
  selectedIds: Set<string>;
  toggleSelect: (jobId: string) => void;
  clearSelection: () => void;
  pinnedJobIds: Set<string>;
  togglePin: (jobId: string) => void;
  lockedJobIds: Set<string>;
  toggleLock: (jobId: string) => void;
  compareJobs: Job[];
  showCompare: boolean;
  setShowCompare: (v: boolean) => void;
  setCompareJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  handleBulkCompare: (rankedJobs: ScoredJob[]) => void;
  handleBulkBoost: (args: BulkNudgeArgs) => void;
  handleBulkBury: (args: BulkNudgeArgs) => void;
  handleBulkMoveTo: (args: BulkMoveArgs) => void;
  handleMoveTo: (args: MoveToArgs) => void;
}

export interface BulkNudgeArgs {
  rankedJobs: ScoredJob[];
  nudgeAmount: number;
  pushAndSetRanked: (u: (p: ScoredJob[]) => ScoredJob[]) => void;
  rankDeltaRef: React.RefObject<Map<string, number>>;
  setFlashMap: React.Dispatch<
    React.SetStateAction<Map<string, "up" | "down">>
  >;
}

export interface BulkMoveArgs {
  targetRank: number;
  pushAndSetRanked: (u: (p: ScoredJob[]) => ScoredJob[]) => void;
}

export interface MoveToArgs {
  jobId: string;
  targetRank: number;
  pushAndSetRanked: (u: (p: ScoredJob[]) => ScoredJob[]) => void;
  scrollToJobIdRef: React.RefObject<string | null>;
}

function toggleInSet(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function useToggleSets() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pinnedJobIds, setPinnedJobIds] = useState<Set<string>>(new Set());
  const [lockedJobIds, setLockedJobIds] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((jobId: string) => { setSelectedIds((prev) => toggleInSet(prev, jobId)); }, []);
  const clearSelection = useCallback(() => { setSelectedIds(new Set()); }, []);
  const togglePin = useCallback((jobId: string) => { setPinnedJobIds((prev) => toggleInSet(prev, jobId)); }, []);
  const toggleLock = useCallback((jobId: string) => { setLockedJobIds((prev) => toggleInSet(prev, jobId)); }, []);
  return { selectedIds, toggleSelect, clearSelection, pinnedJobIds, togglePin, lockedJobIds, toggleLock };
}

function useCompare(selectedIds: Set<string>) {
  const [compareJobs, setCompareJobs] = useState<Job[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const handleBulkCompare = useCallback(
    (rankedJobs: ScoredJob[]) => {
      const jobs = rankedJobs.filter((sj) => selectedIds.has(sj.job.programmeTitle)).slice(0, COMPARE_MAX_JOBS).map((sj) => sj.job);
      setCompareJobs(jobs);
      setShowCompare(true);
    },
    [selectedIds]
  );
  return { compareJobs, showCompare, setShowCompare, setCompareJobs, handleBulkCompare };
}

function doBulkNudge(opts: {
  direction: "up" | "down";
  args: BulkNudgeArgs;
  selectedIds: Set<string>;
  lockedJobIds: Set<string>;
}): void {
  const { direction, args, selectedIds, lockedJobIds } = opts;
  const sign = direction === "up" ? 1 : -1;
  const ids = new Set([...selectedIds].filter((id) => !lockedJobIds.has(id)));
  if (ids.size === 0) return;
  const prev = args.rankedJobs;
  const oldIndices = new Map<string, number>();
  prev.forEach((sj, i) => { if (ids.has(sj.job.programmeTitle)) oldIndices.set(sj.job.programmeTitle, i); });
  const updated = prev.map((sj) =>
    ids.has(sj.job.programmeTitle) ? { ...sj, scoreAdjustment: (sj.scoreAdjustment ?? 0) + sign * args.nudgeAmount } : sj
  );
  const sorted = [...updated].sort((a, b) => effectiveScore(b) - effectiveScore(a));
  sorted.forEach((sj, i) => {
    const oldIdx = oldIndices.get(sj.job.programmeTitle);
    if (oldIdx != null) args.rankDeltaRef.current.set(sj.job.programmeTitle, oldIdx - i);
  });
  args.setFlashMap(() => { const next = new Map<string, "up" | "down">(); ids.forEach((id) => next.set(id, direction)); return next; });
  setTimeout(() => { args.setFlashMap(new Map()); ids.forEach((id) => args.rankDeltaRef.current.delete(id)); }, FLASH_DURATION_MS);
  args.pushAndSetRanked(() => sorted);
}

function useBulkNudge(opts: {
  selectedIds: Set<string>;
  lockedJobIds: Set<string>;
}) {
  const handleBulkBoost = useCallback(
    (args: BulkNudgeArgs) => doBulkNudge({ direction: "up", args, selectedIds: opts.selectedIds, lockedJobIds: opts.lockedJobIds }),
    [opts.selectedIds, opts.lockedJobIds]
  );
  const handleBulkBury = useCallback(
    (args: BulkNudgeArgs) => doBulkNudge({ direction: "down", args, selectedIds: opts.selectedIds, lockedJobIds: opts.lockedJobIds }),
    [opts.selectedIds, opts.lockedJobIds]
  );
  return { handleBulkBoost, handleBulkBury };
}

function useBulkMove(opts: {
  selectedIds: Set<string>;
  lockedJobIds: Set<string>;
}) {
  const handleBulkMoveTo = useCallback(
    (args: BulkMoveArgs) => {
      args.pushAndSetRanked((prev) => {
        const selected = prev.filter((sj) => opts.selectedIds.has(sj.job.programmeTitle) && !opts.lockedJobIds.has(sj.job.programmeTitle));
        if (selected.length === 0) return prev;
        const remaining = prev.filter((sj) => !(opts.selectedIds.has(sj.job.programmeTitle) && !opts.lockedJobIds.has(sj.job.programmeTitle)));
        const insertIdx = Math.max(0, Math.min(args.targetRank - 1, remaining.length));
        const result = [...remaining];
        result.splice(insertIdx, 0, ...selected);
        return result;
      });
    },
    [opts.selectedIds, opts.lockedJobIds]
  );
  const handleMoveTo = useCallback(
    (args: MoveToArgs) => {
      if (opts.lockedJobIds.has(args.jobId)) return;
      args.scrollToJobIdRef.current = args.jobId;
      args.pushAndSetRanked((prev) => {
        const idx = prev.findIndex((sj) => sj.job.programmeTitle === args.jobId);
        if (idx === -1) return prev;
        return arrayMove(prev, idx, Math.max(0, Math.min(args.targetRank - 1, prev.length - 1)));
      });
    },
    [opts.lockedJobIds]
  );
  return { handleBulkMoveTo, handleMoveTo };
}

export function useBulkActions(): BulkActionsReturn {
  const sets = useToggleSets();
  const compare = useCompare(sets.selectedIds);
  const nudge = useBulkNudge({ selectedIds: sets.selectedIds, lockedJobIds: sets.lockedJobIds });
  const move = useBulkMove({ selectedIds: sets.selectedIds, lockedJobIds: sets.lockedJobIds });
  return { ...sets, ...compare, ...nudge, ...move };
}
