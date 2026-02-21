import { useState, useCallback } from "react";
import type { ScoredJob } from "@/lib/scoring";
import { UNDO_HISTORY_LIMIT } from "@/lib/constants";

export interface UndoState {
  rankedJobs: ScoredJob[];
  setRankedJobs: React.Dispatch<React.SetStateAction<ScoredJob[]>>;
  pushAndSetRanked: (updater: (prev: ScoredJob[]) => ScoredJob[]) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function initRankedJobs(scoredJobs: ScoredJob[]): ScoredJob[] {
  return scoredJobs.map((sj) => ({
    ...sj,
    scoreAdjustment: sj.scoreAdjustment ?? 0,
  }));
}

export function useUndoState(scoredJobs: ScoredJob[]): UndoState {
  const [rankedJobs, setRankedJobs] = useState<ScoredJob[]>(
    () => initRankedJobs(scoredJobs)
  );
  const [history, setHistory] = useState<ScoredJob[][]>([]);
  const [future, setFuture] = useState<ScoredJob[][]>([]);

  const pushAndSetRanked = useCallback(
    (updater: (prev: ScoredJob[]) => ScoredJob[]) => {
      setRankedJobs((prev) => {
        setHistory((h) => [...h.slice(-UNDO_HISTORY_LIMIT), prev]);
        setFuture([]);
        return updater(prev);
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [rankedJobs, ...f]);
    setRankedJobs(prev);
  }, [history, rankedJobs]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    setHistory((h) => [...h, rankedJobs]);
    setRankedJobs(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, rankedJobs]);

  return {
    rankedJobs,
    setRankedJobs,
    pushAndSetRanked,
    handleUndo,
    handleRedo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  };
}
