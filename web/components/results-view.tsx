"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from "react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScoredJob } from "@/lib/scoring";
import type { Job, Placement } from "@/lib/parse-xlsx";
import { JobDetailPanel, getRegionStyle } from "@/components/job-detail-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  Lock,
  Unlock,
  Columns2,
  X,
  GripVertical,
  ArrowUpToLine,
  ArrowDownToLine,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

/* ── Constants ── */

const TOP_CONTAINER = "top-droppable";
const POOL_CONTAINER = "pool-droppable";

/* ── Types ── */

interface ResultsViewProps {
  scoredJobs: ScoredJob[];
}

/* ── Helpers ── */

function isValidPlacement(p: Placement) {
  return p.site && p.site !== "None" && p.site.trim() !== "";
}

function getPlacementSummary(job: Job) {
  const sites: string[] = [];
  const specs = new Set<string>();
  for (let i = 1; i <= 6; i++) {
    const key = `placement_${i}` as `placement_${1 | 2 | 3 | 4 | 5 | 6}`;
    const p = job[key];
    if (isValidPlacement(p)) {
      if (!sites.includes(p.site)) sites.push(p.site);
    }
    if (p.speciality && p.speciality !== "None" && p.speciality.trim() !== "")
      specs.add(p.speciality);
  }
  return { sites, specs: Array.from(specs) };
}

/* ── Placement row — 6 equal columns ── */
const PlacementColumns = memo(function PlacementColumns({
  job,
}: {
  job: Job;
}) {
  const placements: { p: Placement; n: number }[] = [];
  for (let i = 1; i <= 6; i++) {
    const key = `placement_${i}` as `placement_${1 | 2 | 3 | 4 | 5 | 6}`;
    const p = job[key];
    if (isValidPlacement(p)) placements.push({ p, n: i });
  }
  if (placements.length === 0) return null;

  return (
    <div className="grid grid-cols-6 gap-px mt-1.5 rounded-md overflow-hidden bg-border/30">
      {placements.map(({ p, n }) => (
        <div
          key={n}
          className="bg-muted/20 dark:bg-muted/10 px-2 py-1.5 min-w-0"
        >
          <p className="text-[11px] leading-tight truncate">{p.site}</p>
          <p className="text-[11px] leading-tight truncate text-muted-foreground">
            {p.speciality}
          </p>
        </div>
      ))}
    </div>
  );
});

/* ── Droppable container wrapper ── */
function DroppableContainer({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

/* ── Unified sortable row (renders differently for top-N vs pool) ── */
const SortableRow = memo(function SortableRow({
  scored,
  displayIndex,
  isPinned,
  isComparing,
  isPool,
  editingIndex,
  editValue,
  onEditStart,
  onEditChange,
  onEditKeyDown,
  onEditBlur,
  onTogglePin,
  onToggleCompare,
  onDemote,
  onPromote,
  onSelectDetail,
}: {
  scored: ScoredJob;
  displayIndex: number;
  isPinned: boolean;
  isComparing: boolean;
  isPool: boolean;
  editingIndex: number | null;
  editValue: string;
  onEditStart: (index: number) => void;
  onEditChange: (value: string) => void;
  onEditKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => void;
  onEditBlur: () => void;
  onTogglePin: (id: string) => void;
  onToggleCompare: (job: Job) => void;
  onDemote: (id: string) => void;
  onPromote: (id: string) => void;
  onSelectDetail: (job: Job) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scored.job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const regionStyle = getRegionStyle(scored.job.region);

  // Build placement columns
  const placements: { site: string; spec: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const key = `placement_${i}` as `placement_${1 | 2 | 3 | 4 | 5 | 6}`;
    const p = scored.job[key];
    if (p.site && p.site !== "None" && p.site.trim() !== "") {
      placements.push({ site: p.site, spec: p.speciality });
    }
  }
  const col1 = placements.slice(0, 3);
  const col2 = placements.slice(3, 6);

  /* ── Pool rendering ── */
  if (isPool) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group rounded-lg border transition-all hover:shadow-md",
          regionStyle.bg,
          regionStyle.border,
          isComparing && "ring-2 ring-sky-400 dark:ring-sky-500",
          isDragging && "opacity-40 shadow-lg z-50"
        )}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => onPromote(scored.job.id)}
            className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
            title="Add to top list"
          >
            <ArrowUpToLine className="h-3.5 w-3.5" />
          </button>

          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
            #{displayIndex + 1}
          </span>

          <span
            className={cn(
              "rounded-full px-1.5 py-0 text-[10px] font-medium border shrink-0",
              regionStyle.text,
              regionStyle.border
            )}
          >
            {scored.job.region}
          </span>

          <span
            className="flex-1 text-[11px] font-mono text-muted-foreground truncate min-w-0 cursor-pointer"
            onClick={() => onSelectDetail(scored.job)}
          >
            {scored.job.programme_title}
          </span>

          <button
            onClick={() => onToggleCompare(scored.job)}
            className={cn(
              "p-1 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100",
              isComparing
                ? "text-sky-500 opacity-100"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Compare"
          >
            <Columns2 className="h-3 w-3" />
          </button>
        </div>

        {/* Placement columns */}
        <div
          className="px-3 pb-2 cursor-pointer"
          onClick={() => onSelectDetail(scored.job)}
        >
          <PlacementColumns job={scored.job} />
        </div>
      </div>
    );
  }

  /* ── Top-N rendering ── */
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border transition-all hover:shadow-sm cursor-pointer",
        regionStyle.bg,
        regionStyle.border,
        isPinned && "ring-1 ring-primary/30",
        isComparing && "ring-2 ring-sky-400 dark:ring-sky-500",
        isDragging && "opacity-40 shadow-lg z-50"
      )}
      onClick={() => onSelectDetail(scored.job)}
    >
      <div className="flex items-start gap-0 px-1.5 py-1">
        {/* LHS: grip + rank/title & region */}
        <div
          className="flex items-start gap-1 shrink-0 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <div className="flex flex-col gap-0">
            {/* Row 1: rank + title */}
            <div className="flex items-center gap-1">
              {editingIndex === displayIndex ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  onKeyDown={(e) => onEditKeyDown(e, displayIndex)}
                  onBlur={onEditBlur}
                  autoFocus
                  className="w-6 rounded border bg-background px-0.5 py-0 text-center text-[10px] font-mono outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <button
                  onClick={() => onEditStart(displayIndex)}
                  className="w-6 shrink-0 text-center text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-background/60 rounded py-0 transition-colors"
                  title="Click to type a new position"
                >
                  {displayIndex + 1}
                </button>
              )}
              <span className="text-[10px] font-mono text-foreground/80 truncate max-w-28">
                {scored.job.programme_title}
              </span>
            </div>
            {/* Row 2: region badge */}
            <span
              className={cn(
                "rounded-full px-1.5 py-0 text-[9px] font-medium border self-start ml-6",
                regionStyle.text,
                regionStyle.border
              )}
            >
              {scored.job.region}
            </span>
          </div>
        </div>

        {/* RHS: 2-col × 3-row placements */}
        <div className="flex-1 min-w-0 flex gap-3 ml-3">
          {[col1, col2].map((col, ci) => (
            <div key={ci} className="flex-1 min-w-0 flex flex-col gap-0.5">
              {col.map((p, pi) => (
                <div key={pi} className="min-w-0">
                  <p className="text-[10px] leading-[13px] text-foreground/80 truncate">
                    {p.site}
                  </p>
                  <p className="text-[9px] leading-[12px] text-muted-foreground truncate">
                    {p.spec}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-0 shrink-0 ml-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onToggleCompare(scored.job)}
            className={cn(
              "p-0.5 rounded transition-colors",
              isComparing
                ? "text-sky-500 opacity-100"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Compare"
          >
            <Columns2 className="h-3 w-3" />
          </button>
          <button
            onClick={() => onTogglePin(scored.job.id)}
            className={cn(
              "p-0.5 transition-colors",
              isPinned
                ? "text-primary opacity-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isPinned ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Unlock className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={() => onDemote(scored.job.id)}
            disabled={isPinned}
            className="p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-30"
            title="Remove from top"
          >
            <ArrowDownToLine className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

/* ── Drag overlay (compact, used for both containers) ── */
const DragOverlayCard = memo(function DragOverlayCard({
  scored,
  index,
}: {
  scored: ScoredJob;
  index: number;
}) {
  const regionStyle = getRegionStyle(scored.job.region);
  const placements: { site: string; spec: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const key = `placement_${i}` as `placement_${1 | 2 | 3 | 4 | 5 | 6}`;
    const p = scored.job[key];
    if (p.site && p.site !== "None" && p.site.trim() !== "") {
      placements.push({ site: p.site, spec: p.speciality });
    }
  }
  const col1 = placements.slice(0, 3);
  const col2 = placements.slice(3, 6);

  return (
    <div
      className={cn(
        "rounded-lg border shadow-xl ring-2 ring-primary/20",
        regionStyle.bg,
        regionStyle.border
      )}
    >
      <div className="flex items-start gap-0 px-2 py-1">
        <div className="flex items-start gap-1 shrink-0 pt-0.5">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0">
            <div className="flex items-center gap-1">
              <span className="w-6 shrink-0 text-center text-[10px] font-mono text-muted-foreground">
                {index + 1}
              </span>
              <span className="text-[10px] font-mono text-foreground/80 truncate max-w-28">
                {scored.job.programme_title}
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-1.5 py-0 text-[9px] font-medium border self-start ml-6",
                regionStyle.text,
                regionStyle.border
              )}
            >
              {scored.job.region}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex gap-3 ml-3">
          {[col1, col2].map((col, ci) => (
            <div key={ci} className="flex-1 min-w-0 flex flex-col gap-0.5">
              {col.map((p, pi) => (
                <div key={pi} className="min-w-0">
                  <p className="text-[10px] leading-[13px] text-foreground/80 truncate">
                    {p.site}
                  </p>
                  <p className="text-[9px] leading-[12px] text-muted-foreground truncate">
                    {p.spec}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   Main results view
   ════════════════════════════════════════════════════════════ */
export function ResultsView({ scoredJobs }: ResultsViewProps) {
  const [topN, setTopN] = useState(20);
  const [rankedJobs, setRankedJobs] = useState<ScoredJob[]>(scoredJobs);
  const [selectedDetail, setSelectedDetail] = useState<Job | null>(null);
  const [compareJobs, setCompareJobs] = useState<Job[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Pool filters
  const [poolSearch, setPoolSearch] = useState("");
  const [poolRegionFilter, setPoolRegionFilter] = useState<string>("all");
  const [poolSpecialtyFilter, setPoolSpecialtyFilter] =
    useState<string>("all");

  // Top-N state
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Scroll refs
  const poolScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);

  // ── Refs for fresh state in DnD callbacks (prevents stale closures) ──
  const rankedJobsRef = useRef(rankedJobs);
  rankedJobsRef.current = rankedJobs;
  const topNRef = useRef(topN);
  topNRef.current = topN;
  const lastOverContainerRef = useRef<string | null>(null);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /* ── Derived data ── */

  const allRegions = useMemo(() => {
    const set = new Set<string>();
    rankedJobs.forEach((s) => set.add(s.job.region));
    return Array.from(set).sort();
  }, [rankedJobs]);

  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    rankedJobs.forEach((s) => {
      for (let i = 1; i <= 6; i++) {
        const key =
          `placement_${i}` as `placement_${1 | 2 | 3 | 4 | 5 | 6}`;
        const spec = s.job[key].speciality;
        if (spec && spec !== "None" && spec.trim() !== "") set.add(spec);
      }
    });
    return Array.from(set).sort();
  }, [rankedJobs]);

  const topList = useMemo(
    () => rankedJobs.slice(0, topN),
    [rankedJobs, topN]
  );
  const pool = useMemo(() => rankedJobs.slice(topN), [rankedJobs, topN]);

  // IDs for SortableContexts
  const topIds = useMemo(() => topList.map((s) => s.job.id), [topList]);

  // O(1) lookup: id → global index in rankedJobs
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    rankedJobs.forEach((s, i) => map.set(s.job.id, i));
    return map;
  }, [rankedJobs]);

  // O(1) set lookups for which container an ID belongs to
  const topIdSet = useMemo(() => new Set(topIds), [topIds]);

  const filteredPool = useMemo(() => {
    return pool.filter((s) => {
      if (poolRegionFilter !== "all" && s.job.region !== poolRegionFilter)
        return false;

      if (poolSpecialtyFilter !== "all") {
        let hasSpec = false;
        for (let i = 1; i <= 6; i++) {
          const key =
            `placement_${i}` as `placement_${1 | 2 | 3 | 4 | 5 | 6}`;
          if (s.job[key].speciality === poolSpecialtyFilter) {
            hasSpec = true;
            break;
          }
        }
        if (!hasSpec) return false;
      }

      if (poolSearch) {
        const q = poolSearch.toLowerCase();
        const title = s.job.programme_title.toLowerCase();
        const region = s.job.region.toLowerCase();
        let sites = "";
        for (let i = 1; i <= 6; i++) {
          const key =
            `placement_${i}` as `placement_${1 | 2 | 3 | 4 | 5 | 6}`;
          sites += " " + s.job[key].site.toLowerCase();
          sites += " " + s.job[key].speciality.toLowerCase();
        }
        if (!title.includes(q) && !region.includes(q) && !sites.includes(q))
          return false;
      }

      return true;
    });
  }, [pool, poolSearch, poolRegionFilter, poolSpecialtyFilter]);

  // Pool IDs — only the *filtered* pool items that are actually rendered
  const poolIds = useMemo(
    () => filteredPool.map((s) => s.job.id),
    [filteredPool]
  );
  const poolIdSet = useMemo(() => new Set(poolIds), [poolIds]);

  // Pre-compute compare set for O(1) lookups
  const compareIdSet = useMemo(
    () => new Set(compareJobs.map((j) => j.id)),
    [compareJobs]
  );

  // Virtualize the pool
  const poolVirtualizer = useVirtualizer({
    count: filteredPool.length,
    getScrollElement: () => poolScrollRef.current,
    estimateSize: () => 98,
    overscan: 5,
  });

  // Reset pool scroll on filter change
  useEffect(() => {
    poolScrollRef.current?.scrollTo(0, 0);
  }, [poolSearch, poolRegionFilter, poolSpecialtyFilter]);

  /* ── Custom collision detection ──
     Step 1: Use pointerWithin to find which *container* the pointer is in
     Step 2: Use closestCenter only against items in that container
     This cuts collision checks from ~1500 to ~20 per frame. */
  const customCollisionDetection: CollisionDetection = useCallback(
    (args) => {
      // First find which droppable container the pointer is inside
      const pointerCollisions = pointerWithin(args);

      // Look for a container-level droppable hit
      const containerHit = pointerCollisions.find(
        (c) => c.id === TOP_CONTAINER || c.id === POOL_CONTAINER
      );

      if (!containerHit) {
        // Fallback: try rectIntersection for edge cases (e.g. overlay near border)
        return rectIntersection(args);
      }

      // Filter droppableContainers to only those in the hit container + the container itself
      const targetIds =
        containerHit.id === TOP_CONTAINER ? topIdSet : poolIdSet;

      const filtered = args.droppableContainers.filter(
        (dc) => dc.id === containerHit.id || targetIds.has(dc.id as string)
      );

      // Now run closestCenter only against the ~20 visible items
      return closestCenter({ ...args, droppableContainers: filtered });
    },
    [topIdSet, poolIdSet]
  );

  /* ── Actions (stabilized callbacks) ── */

  const handleEditStart = useCallback((idx: number) => {
    setEditingIndex(idx);
    setEditValue(String(idx + 1));
  }, []);

  const handleEditBlur = useCallback(() => setEditingIndex(null), []);

  const demoteJob = useCallback(
    (jobId: string) => {
      setRankedJobs((prev) => {
        const idx = prev.findIndex((s) => s.job.id === jobId);
        if (idx < 0 || idx >= topNRef.current) return prev;
        if (pinnedIds.has(jobId)) return prev;
        const newJobs = [...prev];
        const [item] = newJobs.splice(idx, 1);
        newJobs.splice(topNRef.current - 1, 0, item);
        return newJobs;
      });
    },
    [pinnedIds]
  );

  const promoteJob = useCallback(
    (jobId: string) => {
      setRankedJobs((prev) => {
        const idx = prev.findIndex((s) => s.job.id === jobId);
        if (idx < 0 || idx < topNRef.current) return prev;
        const newJobs = [...prev];
        const [item] = newJobs.splice(idx, 1);
        // Insert at end of top-N (last slot)
        newJobs.splice(topNRef.current - 1, 0, item);
        return newJobs;
      });
    },
    []
  );

  const moveInTopN = useCallback(
    (fromIdx: number, toPosition: number) => {
      if (toPosition < 1 || toPosition > topNRef.current) return;
      setRankedJobs((prev) => {
        if (pinnedIds.has(prev[fromIdx].job.id)) return prev;
        const newJobs = [...prev];
        const [item] = newJobs.splice(fromIdx, 1);
        newJobs.splice(toPosition - 1, 0, item);
        return newJobs;
      });
      setEditingIndex(null);
    },
    [pinnedIds]
  );

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCompare = useCallback((job: Job) => {
    setCompareJobs((prev) => {
      const exists = prev.find((j) => j.id === job.id);
      if (exists) return prev.filter((j) => j.id !== job.id);
      if (prev.length >= 3) return prev;
      return [...prev, job];
    });
  }, []);

  const handleRankKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === "Enter") {
        const pos = parseInt(editValue, 10);
        if (!isNaN(pos)) moveInTopN(index, pos);
        setEditingIndex(null);
      } else if (e.key === "Escape") {
        setEditingIndex(null);
      }
    },
    [editValue, moveInTopN]
  );

  /* ── DnD handlers ── */

  /** Determine which container an item ID belongs to (using fresh refs) */
  const findContainer = useCallback(
    (itemId: string): string | null => {
      if (itemId === TOP_CONTAINER || itemId === POOL_CONTAINER) return itemId;
      const jobs = rankedJobsRef.current;
      const n = topNRef.current;
      const idx = jobs.findIndex((s) => s.job.id === itemId);
      if (idx < 0) return null;
      return idx < n ? TOP_CONTAINER : POOL_CONTAINER;
    },
    []
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    lastOverContainerRef.current = findContainer(
      event.active.id as string
    );
  }

  /** Cross-container move: fires every time the drag pointer enters a new container */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const activeContainer = findContainer(activeIdStr);
    const overContainer =
      overIdStr === TOP_CONTAINER || overIdStr === POOL_CONTAINER
        ? overIdStr
        : findContainer(overIdStr);

    if (!activeContainer || !overContainer) return;
    if (activeContainer === overContainer) return;

    // Guard: only fire on container transitions
    if (lastOverContainerRef.current === overContainer) return;
    lastOverContainerRef.current = overContainer;

    setRankedJobs((prev) => {
      const jobs = [...prev];
      const n = topNRef.current;
      const fromIdx = jobs.findIndex((s) => s.job.id === activeIdStr);
      if (fromIdx < 0) return prev;

      const [item] = jobs.splice(fromIdx, 1);

      if (overContainer === TOP_CONTAINER) {
        // Moving to top-N: find drop position within top-N
        if (overIdStr === TOP_CONTAINER) {
          // Dropped on the container itself → append at end of top-N
          jobs.splice(Math.min(n - 1, jobs.length), 0, item);
        } else {
          const overIdx = jobs.findIndex((s) => s.job.id === overIdStr);
          if (overIdx >= 0 && overIdx < n) {
            jobs.splice(overIdx, 0, item);
          } else {
            jobs.splice(Math.min(n - 1, jobs.length), 0, item);
          }
        }
      } else {
        // Moving to pool: insert at the beginning of pool area
        if (overIdStr === POOL_CONTAINER) {
          jobs.splice(n, 0, item);
        } else {
          const overIdx = jobs.findIndex((s) => s.job.id === overIdStr);
          if (overIdx >= 0) {
            jobs.splice(overIdx, 0, item);
          } else {
            jobs.splice(n, 0, item);
          }
        }
      }

      return jobs;
    });
  }

  /** Same-container reorder (fires on drop) */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    lastOverContainerRef.current = null;

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const activeContainer = findContainer(activeIdStr);
    const overContainer =
      overIdStr === TOP_CONTAINER || overIdStr === POOL_CONTAINER
        ? overIdStr
        : findContainer(overIdStr);

    if (!activeContainer || !overContainer) return;

    // Same-container reorder
    if (activeContainer === overContainer) {
      setRankedJobs((prev) => {
        const oldIndex = prev.findIndex((s) => s.job.id === activeIdStr);
        const newIndex = prev.findIndex((s) => s.job.id === overIdStr);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)
          return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
    // Cross-container moves are already handled in handleDragOver
  }

  function handleDragCancel() {
    setActiveId(null);
    lastOverContainerRef.current = null;
  }

  /* ── Overlay data ── */
  const activeScored = activeId
    ? rankedJobs.find((s) => s.job.id === activeId) ?? null
    : null;
  const activeScoredIndex = activeId
    ? indexById.get(activeId) ?? -1
    : -1;

  /* ══════════════════════════════════════════
     Render
     ══════════════════════════════════════════ */

  return (
    <div className="h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* Sub-header with ranking controls */}
      <div className="shrink-0 border-b bg-card px-4 py-2">
        <div className="flex items-center justify-between max-w-400 mx-auto">
          <div>
            <p className="text-xs text-muted-foreground">
              {rankedJobs.length} programmes · Top {topN} highlighted
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Show top:</label>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="rounded-md border bg-background px-2 py-1 text-xs outline-none"
            >
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>
            {compareJobs.length >= 2 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowCompare(true)}
                className="gap-1 text-xs"
              >
                <Columns2 className="h-3.5 w-3.5" />
                Compare ({compareJobs.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Compare overlay */}
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
                      key={job.id}
                      className={cn(
                        "rounded-xl border p-4 space-y-3",
                        style.bg,
                        style.border
                      )}
                    >
                      <div>
                        <h3 className="font-semibold text-sm leading-tight">
                          {job.programme_title}
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
                        {([1, 2, 3, 4, 5, 6] as const).map((i) => {
                          const p =
                            job[
                              `placement_${i}` as `placement_${
                                | 1
                                | 2
                                | 3
                                | 4
                                | 5
                                | 6}`
                            ];
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
                                — {p.speciality}
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

      {/* ── Main content: single DndContext wrapping both panels ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        autoScroll={{
          threshold: { x: 0, y: 0.2 },
          acceleration: 15,
        }}
      >
        <div className="flex-1 flex overflow-hidden">
          {/* ── Left: Top N ── */}
          <div className="w-[30%] shrink-0 border-r flex flex-col bg-card/50">
            <div className="px-4 py-3 border-b bg-card">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  ★
                </span>
                Your Top {topN}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Drag to reorder · click rank # to jump · drag across to
                pool
              </p>
            </div>

            <DroppableContainer
              id={TOP_CONTAINER}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <SortableContext
                items={topIds}
                strategy={verticalListSortingStrategy}
              >
                <div
                  ref={topScrollRef}
                  className="flex-1 overflow-y-auto px-2 py-2 space-y-1"
                >
                  {topList.map((s, index) => (
                    <SortableRow
                      key={s.job.id}
                      scored={s}
                      displayIndex={index}
                      isPinned={pinnedIds.has(s.job.id)}
                      isComparing={compareIdSet.has(s.job.id)}
                      isPool={false}
                      editingIndex={editingIndex}
                      editValue={editValue}
                      onEditStart={handleEditStart}
                      onEditChange={setEditValue}
                      onEditKeyDown={handleRankKeyDown}
                      onEditBlur={handleEditBlur}
                      onTogglePin={togglePin}
                      onToggleCompare={toggleCompare}
                      onDemote={demoteJob}
                      onPromote={promoteJob}
                      onSelectDetail={setSelectedDetail}
                    />
                  ))}
                </div>
              </SortableContext>
            </DroppableContainer>
          </div>

          {/* ── Middle: Pool (virtualized + sortable) ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Pool header + filters */}
            <div className="px-4 py-3 border-b bg-card space-y-2">
              <h2 className="text-sm font-semibold">
                Remaining Programmes
                <span className="ml-1.5 text-muted-foreground font-normal">
                  ({filteredPool.length}
                  {filteredPool.length !== pool.length
                    ? ` of ${pool.length}`
                    : ""}
                  )
                </span>
              </h2>
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-30">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search programmes, sites, specialties..."
                    value={poolSearch}
                    onChange={(e) => setPoolSearch(e.target.value)}
                    className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
                  />
                </div>
                <select
                  value={poolRegionFilter}
                  onChange={(e) => setPoolRegionFilter(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1.5 text-xs outline-none min-w-30"
                >
                  <option value="all">All Regions</option>
                  {allRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={poolSpecialtyFilter}
                  onChange={(e) => setPoolSpecialtyFilter(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1.5 text-xs outline-none min-w-35"
                >
                  <option value="all">All Specialties</option>
                  {allSpecialties.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pool list — virtualized with SortableContext */}
            <DroppableContainer
              id={POOL_CONTAINER}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <SortableContext
                items={poolIds}
                strategy={verticalListSortingStrategy}
              >
                <div
                  ref={poolScrollRef}
                  className="flex-1 overflow-y-auto"
                >
                  <div
                    className="relative px-3 py-2"
                    style={{
                      height: `${poolVirtualizer.getTotalSize()}px`,
                    }}
                  >
                    {poolVirtualizer
                      .getVirtualItems()
                      .map((virtualRow) => {
                        const s = filteredPool[virtualRow.index];
                        return (
                          <div
                            key={s.job.id}
                            className="absolute left-0 right-0 px-3"
                            style={{
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <SortableRow
                              scored={s}
                              displayIndex={
                                indexById.get(s.job.id) ?? -1
                              }
                              isPinned={false}
                              isComparing={compareIdSet.has(
                                s.job.id
                              )}
                              isPool={true}
                              editingIndex={null}
                              editValue=""
                              onEditStart={handleEditStart}
                              onEditChange={setEditValue}
                              onEditKeyDown={handleRankKeyDown}
                              onEditBlur={handleEditBlur}
                              onTogglePin={togglePin}
                              onToggleCompare={toggleCompare}
                              onDemote={demoteJob}
                              onPromote={promoteJob}
                              onSelectDetail={setSelectedDetail}
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              </SortableContext>
            </DroppableContainer>

            {filteredPool.length === 0 && pool.length > 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">
                  No programmes match your filters.
                </p>
                <button
                  onClick={() => {
                    setPoolSearch("");
                    setPoolRegionFilter("all");
                    setPoolSpecialtyFilter("all");
                  }}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>

          {/* Right: Detail panel */}
          {selectedDetail && (
            <div className="w-90 shrink-0">
              <JobDetailPanel
                job={selectedDetail}
                onClose={() => setSelectedDetail(null)}
              />
            </div>
          )}
        </div>

        <DragOverlay>
          {activeScored ? (
            <DragOverlayCard
              scored={activeScored}
              index={activeScoredIndex}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
