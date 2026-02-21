"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore, computeNudgeAmount } from "@/lib/scoring";
import type { Job } from "@/lib/parse-xlsx";
import { isValidPlacement } from "@/lib/parse-xlsx";
import { JobDetailPanel, getRegionStyle } from "@/components/job-detail-panel";
import { MoveToDialog } from "@/components/move-to-dialog";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { ListRow, ListDragOverlayRow } from "@/components/results-view/list-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  Columns2,
  X,
  HelpCircle,
  Download,
  Upload,
  SlidersHorizontal,
  Undo2,
  Redo2,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { WelcomeModal } from "@/components/welcome-modal";
import { exportRankingsToXlsx } from "@/lib/export-xlsx";
import { importRankingsFromXlsx, ImportError } from "@/lib/import-xlsx";
import { useListDragSensors } from "@/hooks/use-list-drag-sensors";
import {
  MOBILE_BREAKPOINT,
  COMPARE_MAX_JOBS,
  UNDO_HISTORY_LIMIT,
  PLACEMENTS_PER_FY,
} from "@/lib/constants";


const ROW_HEIGHT_DESKTOP = 56;
const ROW_HEIGHT_MOBILE = 172;
const VIRTUALIZER_OVERSCAN = 5;
const SAVE_DEBOUNCE_MS = 500;
const EDGE_GLOW_DURATION_MS = 2000;
const FLASH_DURATION_MS = 2500;
const SAFETY_TIMEOUT_MS = 900;
const CASCADE_STAGGER_FAST = 0.08;
const CASCADE_STAGGER_SLOW = 0.05;
const CASCADE_THRESHOLD = 3;


const EASE_P1 = 0.25;
const EASE_P2 = 0.1;
const EASE_BEZIER: [number, number, number, number] = [EASE_P1, EASE_P2, EASE_P1, 1];
const CASCADE_DURATION = 0.35;


const GHOST_DURATION = 0.5;
const GHOST_SCALE_PEAK = 1.05;
const GHOST_OPACITY_END = 0.7;



interface ResultsViewProps {
  scoredJobs: ScoredJob[];
}



function getPlacementSummary(job: Job) {
  const sites: string[] = [];
  const specs = new Set<string>();
  for (const p of job.placements) {
    if (isValidPlacement(p)) {
      if (!sites.includes(p.site)) sites.push(p.site);
    }
    if (p.specialty && p.specialty !== "None" && p.specialty.trim() !== "")
      specs.add(p.specialty);
  }
  return { sites, specs: Array.from(specs) };
}


export function ResultsView({ scoredJobs }: ResultsViewProps) {
  const [rankedJobs, setRankedJobs] = useState<ScoredJob[]>(() =>
    scoredJobs.map((sj) => ({
      ...sj,
      scoreAdjustment: sj.scoreAdjustment ?? 0,
    }))
  );
  const [selectedDetail, setSelectedDetail] = useState<Job | null>(null);
  const [compareJobs, setCompareJobs] = useState<Job[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  
  const rankDeltaRef = useRef<Map<string, number>>(new Map());
  const [flashMap, setFlashMap] = useState<
    Map<string, "up" | "down">
  >(new Map());

  
  const [moveToState, setMoveToState] = useState<{
    jobId: string;
    rank: number;
  } | null>(null);

  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  
  const [bulkMoveToOpen, setBulkMoveToOpen] = useState(false);

  
  const [pinnedJobIds, setPinnedJobIds] = useState<Set<string>>(new Set());
  const [scrollDir, setScrollDir] = useState<"down" | "up">("down");
  const lastScrollTop = useRef(0);

  
  const [lockedJobIds, setLockedJobIds] = useState<Set<string>>(new Set());

  
  const [showHelp, setShowHelp] = useState(false);

  
  const [history, setHistory] = useState<ScoredJob[][]>([]);
  const [future, setFuture] = useState<ScoredJob[][]>([]);

  const pushAndSetRanked = useCallback((updater: (prev: ScoredJob[]) => ScoredJob[]) => {
    setRankedJobs(prev => {
      setHistory(h => [...h.slice(-UNDO_HISTORY_LIMIT), prev]);
      setFuture([]);
      return updater(prev);
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setFuture(f => [rankedJobs, ...f]);
    setRankedJobs(prev);
  }, [history, rankedJobs]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    setHistory(h => [...h, rankedJobs]);
    setRankedJobs(future[0]);
    setFuture(f => f.slice(1));
  }, [future, rankedJobs]);

  
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);


  
  const importFileRef = useRef<HTMLInputElement>(null);

  
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");

  
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  
  const scrollToJobIdRef = useRef<string | null>(null);

  
  type GhostData = {
    scored: ScoredJob;
    rank: number;
    fromRect: { top: number; left: number; width: number; height: number };
    direction: 'up' | 'down';
    targetY: number;
    offScreen: boolean;
  };
  const [ghosts, setGhosts] = useState<Map<string, GhostData>>(new Map());
  const ghostIdCounter = useRef(0);

  
  type CascadeGhostData = {
    scored: ScoredJob;
    rank: number;
    fromX: number;
    fromY: number;
    deltaX: number;
    deltaY: number;
    width: number;
    height: number;
    delay: number;
  };
  const [cascadeGhosts, setCascadeGhosts] = useState<Map<string, CascadeGhostData>>(new Map());
  const [hiddenJobIds, setHiddenJobIds] = useState<Set<string>>(new Set());
  const pendingSortRef = useRef<{
    sorted: ScoredJob[];
    nudgedJobId: string;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  
  const [edgeGlow, setEdgeGlow] = useState<{ side: 'top' | 'bottom'; color: 'green' | 'red' } | null>(null);

  
  const rankedJobsRef = useRef(rankedJobs);
  rankedJobsRef.current = rankedJobs;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function update() { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  const sensors = useListDragSensors();

  
  const nudgeAmount = useMemo(
    () => computeNudgeAmount(rankedJobs),
    [rankedJobs]
  );

  

  const allRegions = useMemo(() => {
    const set = new Set<string>();
    rankedJobs.forEach((s) => set.add(s.job.region));
    return Array.from(set).sort();
  }, [rankedJobs]);

  const allHospitals = useMemo(() => {
    const set = new Set<string>();
    rankedJobs.forEach((s) => {
      for (const p of s.job.placements) {
        if (p.site && p.site !== "None" && p.site.trim() !== "") set.add(p.site);
      }
    });
    return Array.from(set).sort();
  }, [rankedJobs]);

  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    rankedJobs.forEach((s) => {
      for (const p of s.job.placements) {
        if (p.specialty && p.specialty !== "None" && p.specialty.trim() !== "") set.add(p.specialty);
      }
    });
    return Array.from(set).sort();
  }, [rankedJobs]);

  
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    rankedJobs.forEach((s, i) => map.set(s.job.programmeTitle, i));
    return map;
  }, [rankedJobs]);

  const filteredJobs = useMemo(() => {
    return rankedJobs.filter((s) => {
      if (regionFilter !== "all" && s.job.region !== regionFilter) return false;

      if (hospitalFilter !== "all") {
        if (!s.job.placements.some((p) => p.site === hospitalFilter)) return false;
      }

      if (specialtyFilter !== "all") {
        if (!s.job.placements.some((p) => p.specialty === specialtyFilter)) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const title = s.job.programmeTitle.toLowerCase();
        const region = s.job.region.toLowerCase();
        let haystack = "";
        for (const p of s.job.placements) {
          haystack += " " + p.site.toLowerCase();
          haystack += " " + p.specialty.toLowerCase();
        }
        if (
          !title.includes(q) &&
          !region.includes(q) &&
          !haystack.includes(q)
        )
          return false;
      }

      return true;
    });
  }, [rankedJobs, searchQuery, regionFilter, hospitalFilter, specialtyFilter]);

  const filteredJobsRef = useRef(filteredJobs);
  filteredJobsRef.current = filteredJobs;

  
  const filteredIds = useMemo(
    () => filteredJobs.map((s) => s.job.programmeTitle),
    [filteredJobs]
  );

  
  const rowCount = filteredJobs.length;
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP,
    overscan: VIRTUALIZER_OVERSCAN,
  });
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    virtualizerRef.current.measure();
  }, [searchQuery, regionFilter, hospitalFilter, specialtyFilter, isMobile]);

  
  useEffect(() => {
    const targetId = scrollToJobIdRef.current;
    if (!targetId) return;
    scrollToJobIdRef.current = null;

    const idx = filteredJobs.findIndex((sj) => sj.job.programmeTitle === targetId);
    if (idx === -1) return;

    
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
    });
  }, [filteredJobs, virtualizer]);

  
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const json = JSON.stringify(rankedJobs);
        localStorage.setItem("fy_scored_jobs", json);
        sessionStorage.setItem("fy_scored_jobs", json);
      } catch {
        
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rankedJobs]);


  useEffect(() => {
    if (!edgeGlow) return;
    const timer = setTimeout(() => setEdgeGlow(null), EDGE_GLOW_DURATION_MS);
    return () => clearTimeout(timer);
  }, [edgeGlow]);

  
  const pinnedRowIndices = useMemo(() => {
    const rows: number[] = [];
    filteredJobs.forEach((sj, i) => {
      if (pinnedJobIds.has(sj.job.programmeTitle)) rows.push(i);
    });
    return rows;
  }, [filteredJobs, pinnedJobIds]);

  
  const customCollisionDetection: CollisionDetection = useCallback(
    (args) => {
      const virtualItems = virtualizer.getVirtualItems();
      const visibleIds = new Set<string>();
      virtualItems.forEach((vRow) => {
        visibleIds.add(filteredJobs[vRow.index]?.job.programmeTitle);
      });

      const filtered = args.droppableContainers.filter((dc) =>
        visibleIds.has(dc.id as string)
      );

      if (filtered.length === 0) {
        return closestCenter(args);
      }

      return closestCenter({ ...args, droppableContainers: filtered });
    },
    [virtualizer, filteredJobs]
  );

  

  
  interface LaunchGhostOptions {
    jobId: string;
    direction: 'up' | 'down';
    scored: ScoredJob;
    oldRank: number;
    fromRect: DOMRect;
    newIdx: number;
  }

  const launchGhost = useCallback((opts: LaunchGhostOptions) => {
    const { jobId, direction, scored, oldRank, fromRect, newIdx } = opts;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const scrollRect = scrollEl.getBoundingClientRect();

    
    const estRowH = isMobileRef.current ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;
    const newOffset = newIdx * estRowH;
    const viewTop = scrollEl.scrollTop;
    const viewBottom = viewTop + scrollEl.clientHeight;
    const offScreen = newOffset + estRowH <= viewTop || newOffset >= viewBottom;

    let targetY: number;
    if (newOffset + estRowH <= viewTop) {
      targetY = scrollRect.top - fromRect.height / 2;
    } else if (newOffset >= viewBottom) {
      targetY = scrollRect.bottom - fromRect.height / 2;
    } else {
      targetY = scrollRect.top + newOffset - viewTop;
    }

    
    if (offScreen) {
      setEdgeGlow({
        side: direction === 'up' ? 'top' : 'bottom',
        color: direction === 'up' ? 'green' : 'red',
      });
    }

    const ghostKey = `${jobId}-${ghostIdCounter.current++}`;
    setGhosts(prev => {
      const next = new Map(prev);
      next.set(ghostKey, {
        scored,
        rank: oldRank,
        fromRect: {
          top: fromRect.top,
          left: fromRect.left,
          width: fromRect.width,
          height: fromRect.height,
        },
        direction,
        targetY,
        offScreen,
      });
      return next;
    });
  }, []);

  

  const applyPendingSort = useCallback(() => {
    const pending = pendingSortRef.current;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    pushAndSetRanked(() => pending.sorted);
    setHiddenJobIds(new Set());
    setGhosts(new Map());
    setCascadeGhosts(new Map());
    pendingSortRef.current = null;
  }, [pushAndSetRanked]);

  interface CascadeGhostOptions {
    prevJobs: ScoredJob[];
    lo: number;
    hi: number;
    direction: 'up' | 'down';
    gapIdx: number;
  }

  const launchCascadeGhosts = useCallback((opts: CascadeGhostOptions): number => {
    const { prevJobs, lo, hi, direction, gapIdx } = opts;
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl || lo > hi) return 0;

    const contentRect = contentEl.getBoundingClientRect();

    
    const rectCache = new Map<number, DOMRect>();
    for (let i = lo; i <= hi; i++) {
      const sj = prevJobs[i];
      if (!sj) continue;
      const el = scrollEl.querySelector(`[data-job-id="${sj.job.programmeTitle}"]`);
      if (el) rectCache.set(i, el.getBoundingClientRect());
    }
    
    const gapSj = prevJobs[gapIdx];
    if (gapSj) {
      const gapEl = scrollEl.querySelector(`[data-job-id="${gapSj.job.programmeTitle}"]`);
      if (gapEl) rectCache.set(gapIdx, gapEl.getBoundingClientRect());
    }

    const newCascades = new Map<string, CascadeGhostData>();
    let count = 0;

    
    const indices: number[] = [];
    if (direction === 'up') {
      
      for (let i = hi; i >= lo; i--) indices.push(i);
    } else {
      
      for (let i = lo; i <= hi; i++) indices.push(i);
    }

    const totalDisplaced = hi - lo + 1;
    const staggerSec = totalDisplaced <= CASCADE_THRESHOLD ? CASCADE_STAGGER_FAST : CASCADE_STAGGER_SLOW;

    for (const idx of indices) {
      const sj = prevJobs[idx];
      if (!sj) continue;

      const fromRect = rectCache.get(idx);
      if (!fromRect) continue; 

      
      
      
      const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
      const targetRect = rectCache.get(targetIdx);

      
      let deltaX = 0;
      let deltaY = 0;
      if (targetRect) {
        deltaX = targetRect.left - fromRect.left;
        deltaY = targetRect.top - fromRect.top;
      }

      
      if (deltaX === 0 && deltaY === 0 && !targetRect) continue;

      const delay = count * staggerSec;
      const ghostKey = `cascade-${sj.job.programmeTitle}-${ghostIdCounter.current++}`;
      newCascades.set(ghostKey, {
        scored: sj,
        rank: idx + 1,
        fromX: fromRect.left - contentRect.left,
        fromY: fromRect.top - contentRect.top,
        deltaX,
        deltaY,
        width: fromRect.width,
        height: fromRect.height,
        delay,
      });
      count++;
    }

    if (newCascades.size > 0) {
      const hideIds = new Set<string>();
      for (const [, data] of newCascades) {
        hideIds.add(data.scored.job.programmeTitle);
      }
      setHiddenJobIds(prev => {
        const next = new Set(prev);
        for (const id of hideIds) next.add(id);
        return next;
      });
      setCascadeGhosts(prev => {
        const next = new Map(prev);
        for (const [k, v] of newCascades) next.set(k, v);
        return next;
      });
    }

    return count;
  }, []);

  
  const handleNudge = useCallback(
    (jobId: string, direction: 'up' | 'down') => {
      if (lockedJobIds.has(jobId)) return;

      
      if (pendingSortRef.current) {
        clearTimeout(pendingSortRef.current.timeoutId);
        pushAndSetRanked(() => pendingSortRef.current!.sorted);
        setHiddenJobIds(new Set());
        setGhosts(new Map());
        setCascadeGhosts(new Map());
        pendingSortRef.current = null;
      }

      const sign = direction === 'up' ? 1 : -1;

      
      const el = scrollRef.current?.querySelector(`[data-job-id="${jobId}"]`);
      const fromRect = el?.getBoundingClientRect();

      
      const prev = rankedJobsRef.current;
      const oldIdx = prev.findIndex((sj) => sj.job.programmeTitle === jobId);
      if (oldIdx === -1) return;
      const scored = prev[oldIdx];

      const updated = prev.map((sj) =>
        sj.job.programmeTitle === jobId
          ? { ...sj, scoreAdjustment: (sj.scoreAdjustment ?? 0) + sign * nudgeAmount }
          : sj
      );
      const sorted = [...updated].sort(
        (a, b) => effectiveScore(b) - effectiveScore(a)
      );
      const newIdx = sorted.findIndex((sj) => sj.job.programmeTitle === jobId);

      
      if (oldIdx === newIdx) {
        pushAndSetRanked(() => sorted);
        return;
      }

      
      rankDeltaRef.current.set(jobId, oldIdx - newIdx);
      setFlashMap((prev) => {
        const next = new Map(prev);
        next.set(jobId, direction);
        return next;
      });
      setTimeout(() => {
        setFlashMap((prev) => {
          const next = new Map(prev);
          next.delete(jobId);
          return next;
        });
        rankDeltaRef.current.delete(jobId);
      }, FLASH_DURATION_MS);

      
      setHiddenJobIds(new Set([jobId]));

      
      if (fromRect) {
        launchGhost({ jobId, direction, scored, oldRank: oldIdx + 1, fromRect, newIdx });
      }

      
      const [lo, hi] = direction === 'up'
        ? [newIdx, oldIdx - 1]   
        : [oldIdx + 1, newIdx];  
      launchCascadeGhosts({ prevJobs: prev, lo, hi, direction, gapIdx: oldIdx });

      
      const safetyTimeout = setTimeout(() => applyPendingSort(), SAFETY_TIMEOUT_MS);
      pendingSortRef.current = {
        sorted,
        nudgedJobId: jobId,
        timeoutId: safetyTimeout,
      };
    },
    [nudgeAmount, lockedJobIds, pushAndSetRanked, launchGhost, launchCascadeGhosts, applyPendingSort]
  );

  const handleBoost = useCallback(
    (jobId: string) => handleNudge(jobId, 'up'),
    [handleNudge]
  );

  const handleBury = useCallback(
    (jobId: string) => handleNudge(jobId, 'down'),
    [handleNudge]
  );

  
  const handleMoveTo = useCallback((jobId: string, targetRank: number) => {
    if (lockedJobIds.has(jobId)) return;
    scrollToJobIdRef.current = jobId;
    pushAndSetRanked((prev) => {
      const currentIdx = prev.findIndex((sj) => sj.job.programmeTitle === jobId);
      if (currentIdx === -1) return prev;
      const targetIdx = Math.max(
        0,
        Math.min(targetRank - 1, prev.length - 1)
      );
      return arrayMove(prev, currentIdx, targetIdx);
    });
  }, [lockedJobIds, pushAndSetRanked]);

  const openMoveTo = useCallback(
    (jobId: string, rank: number) => {
      setMoveToState({ jobId, rank });
    },
    []
  );

  
  const toggleSelect = useCallback((jobId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  const selectRow = useCallback(
    (rowIndex: number) => {
      const sj = filteredJobs[rowIndex];
      if (!sj) return;
      const jobId = sj.job.programmeTitle;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(jobId)) next.delete(jobId);
        else next.add(jobId);
        return next;
      });
    },
    [filteredJobs]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  
  const handleBulkCompare = useCallback(() => {
    const jobs = rankedJobs
      .filter((sj) => selectedIds.has(sj.job.programmeTitle))
      .slice(0, COMPARE_MAX_JOBS)
      .map((sj) => sj.job);
    setCompareJobs(jobs);
    setShowCompare(true);
  }, [selectedIds, rankedJobs]);

  const handleBulkNudge = useCallback((direction: 'up' | 'down') => {
    const sign = direction === 'up' ? 1 : -1;
    const ids = new Set([...selectedIds].filter((id) => !lockedJobIds.has(id)));
    if (ids.size === 0) return;

    
    const prev = rankedJobsRef.current;
    const oldIndices = new Map<string, number>();
    prev.forEach((sj, i) => { if (ids.has(sj.job.programmeTitle)) oldIndices.set(sj.job.programmeTitle, i); });

    const updated = prev.map((sj) =>
      ids.has(sj.job.programmeTitle)
        ? { ...sj, scoreAdjustment: (sj.scoreAdjustment ?? 0) + sign * nudgeAmount }
        : sj
    );
    const sorted = [...updated].sort(
      (a, b) => effectiveScore(b) - effectiveScore(a)
    );
    sorted.forEach((sj, i) => {
      const oldIdx = oldIndices.get(sj.job.programmeTitle);
      if (oldIdx != null) rankDeltaRef.current.set(sj.job.programmeTitle, oldIdx - i);
    });

    setFlashMap(() => {
      const next = new Map<string, "up" | "down">();
      ids.forEach((id) => next.set(id, direction));
      return next;
    });
    setTimeout(() => {
      setFlashMap(new Map());
      ids.forEach((id) => rankDeltaRef.current.delete(id));
    }, FLASH_DURATION_MS);

    pushAndSetRanked(() => sorted);
  }, [selectedIds, nudgeAmount, lockedJobIds, pushAndSetRanked]);

  const handleBulkBoost = useCallback(() => handleBulkNudge('up'), [handleBulkNudge]);
  const handleBulkBury = useCallback(() => handleBulkNudge('down'), [handleBulkNudge]);

  const handleBulkMoveTo = useCallback(
    (targetRank: number) => {
      pushAndSetRanked((prev) => {
        const selectedJobs = prev.filter((sj) => selectedIds.has(sj.job.programmeTitle) && !lockedJobIds.has(sj.job.programmeTitle));
        if (selectedJobs.length === 0) return prev;
        const remaining = prev.filter((sj) => !(selectedIds.has(sj.job.programmeTitle) && !lockedJobIds.has(sj.job.programmeTitle)));
        const insertIdx = Math.max(
          0,
          Math.min(targetRank - 1, remaining.length)
        );
        const result = [...remaining];
        result.splice(insertIdx, 0, ...selectedJobs);
        return result;
      });
    },
    [selectedIds, lockedJobIds, pushAndSetRanked]
  );

  
  const togglePin = useCallback((jobId: string) => {
    setPinnedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  
  const toggleLock = useCallback((jobId: string) => {
    setLockedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  
  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const jobs = await importRankingsFromXlsx(file);
        setRankedJobs(jobs);
      } catch (err) {
        alert(
          err instanceof ImportError
            ? err.message
            : "Failed to read the file. Make sure it's a valid .xlsx export."
        );
      } finally {
        if (importFileRef.current) importFileRef.current.value = "";
      }
    },
    []
  );

  

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    
    if (lockedJobIds.has(activeIdStr) || lockedJobIds.has(overIdStr)) return;

    pushAndSetRanked((prev) => {
      const oldIndex = prev.findIndex((s) => s.job.programmeTitle === activeIdStr);
      const newIndex = prev.findIndex((s) => s.job.programmeTitle === overIdStr);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)
        return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);

      const moved = reordered[newIndex];
      let targetScore: number;
      if (newIndex === 0) {
        targetScore = effectiveScore(reordered[1]);
      } else {
        targetScore = effectiveScore(reordered[newIndex - 1]);
      }
      const newAdj = targetScore - moved.score;
      reordered[newIndex] = { ...moved, scoreAdjustment: newAdj };

      return reordered;
    });
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dir = el.scrollTop > lastScrollTop.current ? "down" : "up";
    setScrollDir(dir);
    lastScrollTop.current = el.scrollTop;
    setMobileFiltersOpen(false);
  }, []);

  
  const activeScored = activeId
    ? rankedJobs.find((s) => s.job.programmeTitle === activeId) ?? null
    : null;
  const activeScoredRank = activeId ? (indexById.get(activeId) ?? 0) + 1 : 0;

  const hasActiveFilters =
    searchQuery !== "" ||
    regionFilter !== "all" ||
    hospitalFilter !== "all" ||
    specialtyFilter !== "all";

  
  function renderListRow(jobIndex: number) {
    const s = filteredJobs[jobIndex];
    if (!s) return null;
    const globalIdx = indexById.get(s.job.programmeTitle) ?? 0;
    const isHidden = hiddenJobIds.has(s.job.programmeTitle);
    return (
      <div style={isHidden ? { opacity: 0 } : undefined}>
        <ListRow
          key={s.job.programmeTitle}
          scored={s}
          rank={globalIdx + 1}
          isSelected={selectedIds.has(s.job.programmeTitle)}
          isDetailOpen={selectedDetail?.programmeTitle === s.job.programmeTitle}
          isPinned={pinnedJobIds.has(s.job.programmeTitle)}
          isLocked={lockedJobIds.has(s.job.programmeTitle)}
          isMobile={isMobile}
          onSelectDetail={setSelectedDetail}
          onToggleSelect={toggleSelect}
          onTogglePin={togglePin}
          onToggleLock={toggleLock}
          onBoost={handleBoost}
          onBury={handleBury}
          onMoveToOpen={openMoveTo}
          flashDirection={flashMap.get(s.job.programmeTitle) ?? null}
          glowKey={0}
          rankDelta={rankDeltaRef.current.get(s.job.programmeTitle) ?? null}
        />
      </div>
    );
  }

  

  return (
    <div className="h-screen flex flex-col bg-background">
      <WelcomeModal externalOpen={showHelp} onExternalClose={() => setShowHelp(false)} />
      <SiteHeader />

      {}
      <div className="shrink-0 border-b bg-gradient-to-r from-secondary/20 via-accent/10 to-secondary/20 px-4 py-3 hidden sm:block">
        <div className="max-w-[1800px] mx-auto flex items-center gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground shrink-0">
            {filteredJobs.length === rankedJobs.length
              ? `${rankedJobs.length} programmes`
              : `${filteredJobs.length} of ${rankedJobs.length} programmes`}
          </p>

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search programmes, hospitals, specialties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
            />
          </div>

          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none min-w-[140px]"
          >
            <option value="all">All Regions</option>
            {allRegions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={hospitalFilter}
            onChange={(e) => setHospitalFilter(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none min-w-[160px] max-w-[220px]"
          >
            <option value="all">All Hospitals</option>
            {allHospitals.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none min-w-[160px] max-w-[220px]"
          >
            <option value="all">All Specialties</option>
            {allSpecialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchQuery("");
                setRegionFilter("all");
                setHospitalFilter("all");
                setSpecialtyFilter("all");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Clear filters
            </button>
          )}

          {compareJobs.length >= 2 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCompare(true)}
              className="gap-1 text-sm shrink-0"
            >
              <Columns2 className="h-4 w-4" />
              Compare ({compareJobs.length})
            </Button>
          )}

          {}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => exportRankingsToXlsx(rankedJobs)}
            >
              <Download className="h-3.5 w-3.5" />
              Export .xlsx
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx"
              onChange={handleImportFile}
              className="hidden"
              id="import-rankings"
            />
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs"
              onClick={() => importFileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
          </div>

          {}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-xs px-2"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-xs px-2"
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <button
            onClick={() => setShowHelp(true)}
            className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {}
      <div className="shrink-0 border-b bg-gradient-to-r from-secondary/20 via-accent/10 to-secondary/20 px-2 py-1.5 sm:hidden">
        {mobileSearchOpen ? (
          
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search programmes, hospitals, specialties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full rounded-md border bg-background pl-8 pr-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); }}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          
          <div className="flex items-center gap-0.5">
            <p className="text-xs font-medium text-muted-foreground shrink-0 px-1">
              {filteredJobs.length === rankedJobs.length
                ? `${rankedJobs.length}`
                : `${filteredJobs.length}/${rankedJobs.length}`}
            </p>

            <button
              onClick={() => setMobileFiltersOpen((o) => !o)}
              className={cn(
                "relative p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md transition-colors shrink-0",
                mobileFiltersOpen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {hasActiveFilters && !mobileFiltersOpen && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>

            <button
              onClick={() => setMobileSearchOpen(true)}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              onClick={() => exportRankingsToXlsx(rankedJobs)}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Export"
            >
              <Download className="h-4 w-4" />
            </button>

            <button
              onClick={() => importFileRef.current?.click()}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Import"
            >
              <Upload className="h-4 w-4" />
            </button>

            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={cn(
                "p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md transition-colors shrink-0",
                history.length === 0
                  ? "text-muted-foreground/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>

            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className={cn(
                "p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md transition-colors shrink-0",
                future.length === 0
                  ? "text-muted-foreground/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </button>

            <button
              onClick={() => setShowHelp(true)}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 ml-auto"
              title="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {}
        {mobileFiltersOpen && !mobileSearchOpen && (
          <div className="mt-2 space-y-2">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="all">All Regions</option>
              {allRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="all">All Hospitals</option>
              {allHospitals.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="all">All Specialties</option>
              {allSpecialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setRegionFilter("all");
                  setHospitalFilter("all");
                  setSpecialtyFilter("all");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {}
      {showCompare && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold text-sm">
                Comparing {compareJobs.length} programmes
              </h2>
              <button
                onClick={() => setShowCompare(false)}
                className="p-1 rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${compareJobs.length}, 1fr)`,
                }}
              >
                {compareJobs.map((job) => {
                  const style = getRegionStyle(job.region);
                  const { sites, specs } = getPlacementSummary(job);
                  return (
                    <div
                      key={job.programmeTitle}
                      className={cn(
                        "rounded-xl border p-4 space-y-3",
                        style.bg,
                        style.border
                      )}
                    >
                      <div>
                        <h3 className="font-semibold text-sm leading-tight">
                          {job.programmeTitle}
                        </h3>
                        <span
                          className={cn(
                            "inline-block mt-1 text-xs font-medium",
                            style.text
                          )}
                        >
                          {job.region}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Sites
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {sites.map((s) => (
                            <span
                              key={s}
                              className="rounded-md bg-background/60 border px-1.5 py-0.5 text-[11px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Specialties
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {specs.map((s) => (
                            <span
                              key={s}
                              className="rounded-md bg-background/60 border px-1.5 py-0.5 text-[11px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          All placements
                        </p>
                        {job.placements.map((p, i) => {
                          if (
                            !p.site ||
                            p.site === "None" ||
                            p.site.trim() === ""
                          )
                            return null;
                          return (
                            <div
                              key={i}
                              className="text-xs p-2 rounded-md bg-background/50 border"
                            >
                              <span className="font-medium">{p.site}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                — {p.specialty}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-3 border-t flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCompareJobs([]);
                  setShowCompare(false);
                }}
              >
                Clear comparison
              </Button>
            </div>
          </div>
        </div>
      )}

      {}
      <MoveToDialog
        open={moveToState !== null}
        onOpenChange={(open) => {
          if (!open) setMoveToState(null);
        }}
        currentRank={moveToState?.rank ?? 1}
        totalJobs={rankedJobs.length}
        onMoveTo={(target) => {
          if (moveToState) handleMoveTo(moveToState.jobId, target);
        }}
      />

      {}
      <MoveToDialog
        open={bulkMoveToOpen}
        onOpenChange={setBulkMoveToOpen}
        currentRank={1}
        totalJobs={rankedJobs.length}
        onMoveTo={(target) => {
          handleBulkMoveTo(target);
          setBulkMoveToOpen(false);
        }}
      />

      {}
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        autoScroll={{
          threshold: { x: 0, y: 0.2 },
          acceleration: 15,
        }}
      >
        <div className="flex-1 flex overflow-hidden">
          <SortableContext
            items={filteredIds}
            strategy={verticalListSortingStrategy}
          >
            <div ref={contentRef} className="flex-1 flex flex-col overflow-hidden relative">
              {}
              {edgeGlow && (
                <div
                  className={cn(
                    "absolute left-0 right-0 h-14 z-30 pointer-events-none",
                    edgeGlow.side === 'top' ? 'top-0' : 'bottom-0',
                    edgeGlow.color === 'green' ? 'edge-glow-green' : 'edge-glow-red'
                  )}
                  onAnimationEnd={() => setEdgeGlow(null)}
                />
              )}

              {}
              {pinnedRowIndices.length > 0 &&
                scrollDir === "down" && (
                  <div className="shrink-0 z-10 shadow-md border-b max-h-[30vh] overflow-y-auto">
                    {pinnedRowIndices.map((jobIdx) => (
                      <div key={`pin-${jobIdx}`} className={cn(!isMobile && (jobIdx % 2 === 0 ? "bg-row-even" : "bg-row-odd"))}>
                        {renderListRow(jobIdx)}
                      </div>
                    ))}
                  </div>
                )}

              {}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                onScroll={handleScroll}
              >
                <div>
                  {}
                  <div
                    className="hidden sm:grid items-center gap-x-0.5 h-[32px] border-b-2 border-border bg-secondary/30"
                    style={{
                      gridTemplateColumns: "40px auto minmax(100px,auto) repeat(6, minmax(90px, 1fr)) 90px 140px",
                    }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right pr-2">#</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Region</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-16">Programme</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-1.5">P1 <span className="font-normal text-muted-foreground">(FY1)</span></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-1.5">P2 <span className="font-normal text-muted-foreground">(FY1)</span></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-1.5">P3 <span className="font-normal text-muted-foreground">(FY1)</span></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-1.5">P4 <span className="font-normal text-muted-foreground">(FY2)</span></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-1.5">P5 <span className="font-normal text-muted-foreground">(FY2)</span></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-1.5">P6 <span className="font-normal text-muted-foreground">(FY2)</span></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Score</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Actions</span>
                  </div>
                  <div
                    className="relative"
                    style={{ height: `${virtualizer.getTotalSize()}px` }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const isEvenRow = virtualRow.index % 2 === 0;
                      return (
                        <div
                          key={virtualRow.index}
                          className={cn(
                            "absolute left-0 right-0",
                            !isMobile && (isEvenRow ? "bg-row-even" : "bg-row-odd")
                          )}
                          style={{
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {renderListRow(virtualRow.index)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {filteredJobs.length === 0 && rankedJobs.length > 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">
                      No programmes match your filters.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setRegionFilter("all");
                        setHospitalFilter("all");
                        setSpecialtyFilter("all");
                      }}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>

              {}
              {pinnedRowIndices.length > 0 &&
                scrollDir === "up" && (
                  <div className="shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0_0_0/0.1)] border-t max-h-[30vh] overflow-y-auto">
                    {pinnedRowIndices.map((jobIdx) => (
                      <div key={`pin-${jobIdx}`} className={cn(!isMobile && (jobIdx % 2 === 0 ? "bg-row-even" : "bg-row-odd"))}>
                        {renderListRow(jobIdx)}
                      </div>
                    ))}
                  </div>
                )}

              {}
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
            </div>
          </SortableContext>

          {}
          {selectedIds.size >= 1 && (
            <SelectionToolbar
              count={selectedIds.size}
              selectedJobs={rankedJobs.filter((sj) =>
                selectedIds.has(sj.job.programmeTitle)
              )}
              onClear={clearSelection}
              onCompare={handleBulkCompare}
              onMoveTo={() => setBulkMoveToOpen(true)}
              onBoostAll={handleBulkBoost}
              onBuryAll={handleBulkBury}
            />
          )}

        </div>

        <DragOverlay>
          {activeScored ? (
            <ListDragOverlayRow
              scored={activeScored}
              rank={activeScoredRank}
              isMobile={isMobile}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {}
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
            onAnimationComplete={() => {
              setGhosts(prev => {
                const next = new Map(prev);
                next.delete(id);
                return next;
              });
              applyPendingSort();
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

      {}

      {}
      <AnimatePresence>
        {selectedDetail && (
          <JobDetailPanel
            key={selectedDetail.programmeTitle}
            job={selectedDetail}
            onClose={() => setSelectedDetail(null)}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
