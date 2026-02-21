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
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
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
import { motion, AnimatePresence } from "framer-motion";
import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore, computeNudgeAmount } from "@/lib/scoring";
import type { Job, Placement } from "@/lib/parse-xlsx";
import { isValidPlacement, getJobPlacements, type PlacementEntry } from "@/lib/parse-xlsx";
import { JobDetailPanel, getRegionStyle } from "@/components/job-detail-panel";
import { MoveToDialog } from "@/components/move-to-dialog";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  Columns2,
  X,
  ArrowUpDown,
  Pin,
  Lock,
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

/* ── Types ── */

interface ResultsViewProps {
  scoredJobs: ScoredJob[];
}

/* ── Helpers ── */

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

/* ── Animated score display ── */
function AnimatedScore({
  value,
  flashDirection,
}: {
  value: number;
  flashDirection: "up" | "down" | null;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const animRef = useRef<number | null>(null);
  const flashKey = useRef(0);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    const start = displayValue;
    const end = value;
    if (Math.abs(start - end) < 0.0001) return;

    const duration = 700; // ms
    const startTime = performance.now();

    if (animRef.current) cancelAnimationFrame(animRef.current);

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(start + (end - start) * eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    }
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!flashDirection) return;
    flashKey.current++;
    setFlashClass(
      flashDirection === "up" ? "animate-score-up" : "animate-score-down"
    );
    const timeout = setTimeout(() => setFlashClass(""), 600);
    return () => clearTimeout(timeout);
  }, [flashDirection]);

  return (
    <span
      key={flashKey.current}
      className={cn(
        "font-mono tabular-nums text-xs font-semibold text-foreground transition-colors",
        flashClass
      )}
    >
      {displayValue.toFixed(3)}
    </span>
  );
}

/* ── Rank change badge ── */
function RankChangeBadge({ delta, direction }: { delta: number | null; direction: "up" | "down" | null }) {
  return (
    <AnimatePresence>
      {delta != null && delta !== 0 && direction && (
        <motion.span
          key={delta}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-bold font-mono tabular-nums leading-tight",
            direction === "up"
              ? "bg-emerald-900/50 text-emerald-300"
              : "bg-red-900/50 text-red-300"
          )}
        >
          {direction === "up" ? "+" : ""}{delta}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ── Arrow icons for boost/bury ── */
function ArrowUp() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M5 12L12 5L19 12" />
    </svg>
  );
}
function ArrowDown() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5V19" />
      <path d="M19 12L12 19L5 12" />
    </svg>
  );
}

/* ── Placement row: two-line layout (hospital + specialty) ── */

const PlacementRow = memo(function PlacementRow({
  entry,
}: {
  entry: PlacementEntry;
}) {
  return (
    <div className="flex gap-2 items-start py-0.5">
      <span className="w-4 shrink-0 text-xs font-mono font-semibold text-muted-foreground text-right pt-0.5">
        {entry.num}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground leading-tight truncate">
          {entry.spec || "No specialty listed"}
        </p>
        <p className="text-xs font-semibold italic text-foreground leading-tight truncate">
          {entry.site || "No site listed"}
        </p>
      </div>
    </div>
  );
});

/* ── Single FY group: bracket on left, rows on right ── */
const FYGroup = memo(function FYGroup({
  label,
  entries,
}: {
  label: string;
  entries: PlacementEntry[];
}) {
  const slots: (PlacementEntry | null)[] = [
    entries[0] ?? null,
    entries[1] ?? null,
    entries[2] ?? null,
  ];

  return (
    <div className="flex items-stretch gap-0">
      {/* Label + left curly bracket */}
      <div className="flex items-center shrink-0 pr-1.5">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mr-1 whitespace-nowrap">
          {label}
        </span>
        <svg
          className="text-muted-foreground shrink-0"
          width="10"
          viewBox="0 0 10 60"
          preserveAspectRatio="none"
          style={{ height: "100%" }}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M10,2 Q4,2 4,15 Q4,28 0,30 Q4,32 4,45 Q4,58 10,58" />
        </svg>
      </div>
      {/* Rows */}
      <div className="flex-1 min-w-0 flex flex-col">
        {slots.map((entry, i) =>
          entry ? (
            <PlacementRow key={entry.num} entry={entry} />
          ) : (
            <div key={i} className="flex gap-2 items-start py-0.5">
              <span className="w-4 shrink-0 text-xs font-mono font-semibold text-muted-foreground text-right pt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground leading-tight">No placement</p>
                <p className="text-xs text-muted-foreground leading-tight">&nbsp;</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
});

/* ── Placement list (FY1 + FY2 groups) ── */
const PlacementList = memo(function PlacementList({
  fy1,
  fy2,
}: {
  fy1: PlacementEntry[];
  fy2: PlacementEntry[];
}) {
  return (
    <div className="space-y-0.5">
      <FYGroup label="FY1" entries={fy1} />
      <FYGroup label="FY2" entries={fy2} />
    </div>
  );
});

/* ── Swipe-to-boost/bury hook (mobile) ── */
const SWIPE_THRESHOLD = 60;

function useSwipeBoostBury({
  onBoost,
  onBury,
  isDragging,
  isLocked,
}: {
  onBoost: () => void;
  onBury: () => void;
  isDragging: boolean;
  isLocked: boolean;
}) {
  const touchRef = useRef<{ x: number; y: number; aborted: boolean } | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeCommitted, setSwipeCommitted] = useState<"boost" | "bury" | null>(null);
  // Which action would fire on release — shown as iOS-style reveal
  const [pendingAction, setPendingAction] = useState<"boost" | "bury" | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isDragging || isLocked) return;
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY, aborted: false };
    setSwipeX(0);
    setSwipeCommitted(null);
    setPendingAction(null);
  }, [isDragging, isLocked]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const ref = touchRef.current;
    if (!ref || ref.aborted || isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - ref.x;
    const dy = touch.clientY - ref.y;
    // If vertical movement dominates early on, abort permanently
    if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 10) {
      ref.aborted = true;
      setSwipeX(0);
      setPendingAction(null);
      return;
    }
    if (Math.abs(dx) > 10) {
      setSwipeX(dx);
      // Update pending action based on threshold
      if (dx >= SWIPE_THRESHOLD) setPendingAction("boost");
      else if (dx <= -SWIPE_THRESHOLD) setPendingAction("bury");
      else setPendingAction(null);
    }
  }, [isDragging]);

  const onTouchEnd = useCallback(() => {
    const ref = touchRef.current;
    touchRef.current = null;
    if (!ref || ref.aborted) {
      setSwipeX(0);
      setPendingAction(null);
      return;
    }

    // Fire if past threshold — no time limit, user can hold as long as they want
    if (pendingAction === "boost") {
      setSwipeCommitted("boost");
      onBoost();
    } else if (pendingAction === "bury") {
      setSwipeCommitted("bury");
      onBury();
    }

    setSwipeX(0);
    setPendingAction(null);
    setTimeout(() => setSwipeCommitted(null), 400);
  }, [pendingAction, onBoost, onBury]);

  return { swipeX, swipeCommitted, pendingAction, onTouchStart, onTouchMove, onTouchEnd };
}

/* ── Sortable list row ── */
const ListRow = memo(function ListRow({
  scored,
  rank,
  isSelected,
  isPinned,
  isLocked,
  isMobile,
  onSelectDetail,
  onToggleSelect,
  onTogglePin,
  onToggleLock,
  onBoost,
  onBury,
  onMoveToOpen,
  flashDirection,
  glowKey,
  rankDelta,
  isDetailOpen,
}: {
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
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scored.job.programmeTitle, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const regionStyle = getRegionStyle(scored.job.region);
  const { fy1, fy2 } = getJobPlacements(scored.job);
  const score = effectiveScore(scored);

  const washClass =
    flashDirection === "up"
      ? "animate-wash-up"
      : flashDirection === "down"
        ? "animate-wash-down"
        : "";

  // Build placement array for all 6 slots
  const allPlacements: (PlacementEntry | null)[] = [];
  for (let i = 0; i < 3; i++) allPlacements.push(fy1[i] ?? null);
  for (let i = 0; i < 3; i++) allPlacements.push(fy2[i] ?? null);

  // Swipe gesture for mobile boost/bury
  const handleSwipeBoost = useCallback(() => onBoost(scored.job.programmeTitle), [onBoost, scored.job.programmeTitle]);
  const handleSwipeBury = useCallback(() => onBury(scored.job.programmeTitle), [onBury, scored.job.programmeTitle]);
  const { swipeX, swipeCommitted, pendingAction, onTouchStart, onTouchMove, onTouchEnd } = useSwipeBoostBury({
    onBoost: handleSwipeBoost,
    onBury: handleSwipeBury,
    isDragging,
    isLocked,
  });

  if (isMobile) {
    return (
      <div
        key={glowKey}
        ref={setNodeRef}
        data-job-id={scored.job.programmeTitle}
        style={{
          ...style,
          boxShadow: isSelected
            ? undefined
            : `0 2px 8px ${regionStyle.color}20, 0 1px 3px rgba(0,0,0,0.06)`,
        }}
        {...attributes}
        {...listeners}
        className={cn(
          "relative overflow-hidden rounded-xl mx-3 my-1 transition-all duration-150",
          isLocked ? "cursor-default" : "cursor-grab",
          isSelected
            ? "bg-card-selected ring-1 ring-primary/60"
            : isDetailOpen
              ? "ring-1 ring-primary/40 bg-primary/5"
              : "hover:bg-card-hover",
          isDragging && "opacity-30 scale-[0.97] z-50",
          isLocked && "bg-amber-950/20"
        )}
        onClick={() => onSelectDetail(scored.job)}
        role="row"
      >
        {/* iOS-style action reveal behind the sliding row */}
        {(swipeX > 0 || pendingAction === "boost") && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-start pl-4 rounded-xl transition-colors duration-150",
            pendingAction === "boost" ? "bg-emerald-500" : "bg-emerald-500/20"
          )}>
            {swipeX > 15 && (
              <div className="flex items-center gap-2">
                <ArrowUp />
                <span className={cn(
                  "text-sm font-bold transition-opacity",
                  pendingAction === "boost" ? "text-white opacity-100" : "text-emerald-400 opacity-70"
                )}>Boost</span>
              </div>
            )}
          </div>
        )}
        {(swipeX < 0 || pendingAction === "bury") && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-end pr-4 rounded-xl transition-colors duration-150",
            pendingAction === "bury" ? "bg-red-500" : "bg-red-500/20"
          )}>
            {swipeX < -15 && (
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm font-bold transition-opacity",
                  pendingAction === "bury" ? "text-white opacity-100" : "text-red-400 opacity-70"
                )}>Bury</span>
                <ArrowDown />
              </div>
            )}
          </div>
        )}

        {/* Sliding row content */}
        <motion.div
          className={cn("relative flex flex-col py-2 px-2.5 bg-card rounded-xl", washClass)}
          animate={{ x: swipeX }}
          transition={swipeX === 0 ? { type: "spring", stiffness: 500, damping: 30 } : { duration: 0 }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Header: rank + region + title + score */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold font-mono text-foreground shrink-0">
              {rank}
            </span>
            <RankChangeBadge delta={rankDelta} direction={flashDirection} />
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold border shrink-0",
                regionStyle.bg,
                regionStyle.text,
                regionStyle.border
              )}
            >
              {scored.job.region}
            </span>
            <span className="flex-1 text-xs font-mono font-semibold text-foreground truncate min-w-0">
              {scored.job.programmeTitle}
            </span>
            <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1 shrink-0">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Score
              </span>
              <AnimatedScore value={score} flashDirection={flashDirection} />
            </div>
          </div>

          {/* FY1 / FY2 placements – numbered, fixed-geometry grid */}
          <div className="grid grid-cols-2 gap-x-3 mt-1.5">
            {([["FY1", fy1, 0], ["FY2", fy2, 3]] as const).map(([label, entries, offset]) => (
              <div key={label}>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {label}
                </span>
                {[0, 1, 2].map((i) => {
                  const entry = entries[i];
                  const slotNum = offset + i + 1;
                  return (
                    <div
                      key={slotNum}
                      className={cn(
                        "mt-0.5 pt-0.5",
                        i > 0 && "border-t border-border/40"
                      )}
                    >
                      {entry ? (
                        <>
                          <p className="text-[11px] font-semibold text-foreground leading-tight truncate">
                            <span className="inline-block w-3 text-[10px] font-bold text-muted-foreground tabular-nums">
                              {slotNum}
                            </span>
                            {entry.spec || "No specialty listed"}
                          </p>
                          <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate pl-3">
                            {entry.site || "No site listed"}
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          <span className="inline-block w-3 text-[10px] font-bold tabular-nums">
                            {slotNum}
                          </span>
                          —
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      key={glowKey}
      ref={setNodeRef}
      data-job-id={scored.job.programmeTitle}
      style={{
        ...style,
        gridTemplateColumns: "40px auto minmax(100px,auto) repeat(6, minmax(90px, 1fr)) 90px 140px",
        boxShadow: isSelected
          ? undefined
          : `inset 3px 0 0 ${regionStyle.color}40`,
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "relative grid items-center gap-x-0.5 h-[56px] border-b border-border transition-all duration-150",
        isLocked ? "cursor-default" : "cursor-grab",
        isSelected
          ? "bg-card-selected ring-1 ring-primary/60"
          : isDetailOpen
            ? "ring-1 ring-primary/40 bg-primary/5"
            : "hover:bg-card-hover",
        isDragging && "opacity-30 scale-[0.97] z-50",
        isLocked && "bg-amber-950/20",
        washClass
      )}
      onClick={() => onSelectDetail(scored.job)}
      role="row"
    >
      {/* Rank */}
      <div className="flex items-center justify-end gap-1 pr-2">
        <RankChangeBadge delta={rankDelta} direction={flashDirection} />
        <span className="text-sm font-bold font-mono text-foreground">
          {rank}
        </span>
      </div>

      {/* Region */}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold border truncate text-center mr-1",
          regionStyle.bg,
          regionStyle.text,
          regionStyle.border
        )}
      >
        {scored.job.region}
      </span>

      {/* Programme title */}
      <span className="text-xs font-mono font-semibold text-foreground truncate pr-16">
        {scored.job.programmeTitle}
      </span>

      {/* 6 individual placement columns */}
      {allPlacements.map((entry, i) => (
        <div key={i} className="min-w-0 pr-0.5">
          {entry ? (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground leading-tight truncate">
                {entry.spec}
              </p>
              <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate">
                {entry.site}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ))}

      {/* Score */}
      <div className="flex justify-center">
        <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Score
          </span>
          <AnimatedScore value={score} flashDirection={flashDirection} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBoost(scored.job.programmeTitle);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "p-0.5 rounded text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 active:scale-90 transition-all",
            isLocked && "pointer-events-none opacity-30"
          )}
          title="Boost"
        >
          <ArrowUp />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBury(scored.job.programmeTitle);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "p-0.5 rounded text-red-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all",
            isLocked && "pointer-events-none opacity-30"
          )}
          title="Bury"
        >
          <ArrowDown />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveToOpen(scored.job.programmeTitle, rank);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
            isLocked && "pointer-events-none opacity-30"
          )}
          title="Move to..."
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(scored.job.programmeTitle);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "p-0.5 rounded transition-colors",
            isPinned
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          title={isPinned ? "Unpin" : "Pin"}
        >
          <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-primary")} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(scored.job.programmeTitle);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "p-0.5 rounded transition-colors",
            isLocked
              ? "text-amber-500"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          title={isLocked ? "Unlock" : "Lock"}
        >
          <Lock className={cn("h-3.5 w-3.5", isLocked && "fill-amber-500/20")} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(scored.job.programmeTitle);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-0.5 flex items-center justify-center"
          title={isSelected ? "Deselect" : "Select"}
        >
          <div
            className={cn(
              "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
              isSelected
                ? "bg-primary border-primary"
                : "border-muted-foreground hover:border-primary"
            )}
          >
            {isSelected && (
              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
});

/* ── List drag overlay row ── */
const ListDragOverlayRow = memo(function ListDragOverlayRow({
  scored,
  rank,
  isMobile,
}: {
  scored: ScoredJob;
  rank: number;
  isMobile?: boolean;
}) {
  const regionStyle = getRegionStyle(scored.job.region);
  const { fy1, fy2 } = getJobPlacements(scored.job);
  const score = effectiveScore(scored);

  const allPlacements: (PlacementEntry | null)[] = [];
  for (let i = 0; i < 3; i++) allPlacements.push(fy1[i] ?? null);
  for (let i = 0; i < 3; i++) allPlacements.push(fy2[i] ?? null);

  if (isMobile) {
    return (
      <div
        className="flex flex-col py-2 px-2.5 bg-card-drag ring-2 ring-primary/50 scale-[1.03] rounded-md transition-all duration-150"
        style={{ boxShadow: `0 12px 32px ${regionStyle.color}40, 0 6px 16px rgba(0,0,0,0.15)` }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold font-mono text-foreground shrink-0">{rank}</span>
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold border shrink-0", regionStyle.bg, regionStyle.text, regionStyle.border)}>
            {scored.job.region}
          </span>
          <span className="flex-1 text-xs font-mono font-semibold text-foreground truncate min-w-0">
            {scored.job.programmeTitle}
          </span>
          <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1 shrink-0">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Score</span>
            <span className="font-mono tabular-nums text-xs font-semibold text-foreground">{score.toFixed(3)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0 mt-1.5">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">FY1</span>
            {[0, 1, 2].map((i) => {
              const entry = fy1[i];
              return entry ? (
                <div key={entry.num} className="mt-1.5">
                  <p className="text-[11px] font-semibold text-foreground leading-tight truncate">{entry.spec}</p>
                  <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate">{entry.site}</p>
                </div>
              ) : (
                <div key={i} className="mt-1.5"><span className="text-[11px] text-muted-foreground">—</span></div>
              );
            })}
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">FY2</span>
            {[0, 1, 2].map((i) => {
              const entry = fy2[i];
              return entry ? (
                <div key={entry.num} className="mt-1.5">
                  <p className="text-[11px] font-semibold text-foreground leading-tight truncate">{entry.spec}</p>
                  <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate">{entry.site}</p>
                </div>
              ) : (
                <div key={i} className="mt-1.5"><span className="text-[11px] text-muted-foreground">—</span></div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid items-center gap-x-0.5 h-[56px] bg-card-drag ring-2 ring-primary/50 scale-[1.03] rounded-md transition-all duration-150"
      style={{
        gridTemplateColumns: "40px auto minmax(100px,auto) repeat(6, minmax(90px, 1fr)) 90px 140px",
        boxShadow: `0 12px 32px ${regionStyle.color}40, 0 6px 16px rgba(0,0,0,0.15)`,
      }}
    >
      <span className="text-sm font-bold font-mono text-foreground text-right pr-2">
        {rank}
      </span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold border truncate text-center",
          regionStyle.bg,
          regionStyle.text,
          regionStyle.border
        )}
      >
        {scored.job.region}
      </span>
      <span className="text-xs font-mono font-semibold text-foreground truncate pr-16">
        {scored.job.programmeTitle}
      </span>
      {allPlacements.map((entry, i) => (
        <div key={i} className="min-w-0 pr-0.5">
          {entry ? (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground leading-tight truncate">
                {entry.spec}
              </p>
              <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate">
                {entry.site}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ))}
      <div className="flex justify-center">
        <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Score
          </span>
          <span className="font-mono tabular-nums text-xs font-semibold text-foreground">
            {score.toFixed(3)}
          </span>
        </div>
      </div>
      <span />
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   Main results view
   ════════════════════════════════════════════════════════════ */
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

  // Boost/Bury flash tracking
  const rankDeltaRef = useRef<Map<string, number>>(new Map());
  const [flashMap, setFlashMap] = useState<
    Map<string, "up" | "down">
  >(new Map());

  // Move To dialog
  const [moveToState, setMoveToState] = useState<{
    jobId: string;
    rank: number;
  } | null>(null);

  // Multiselect
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Move To for bulk (from toolbar)
  const [bulkMoveToOpen, setBulkMoveToOpen] = useState(false);

  // Pin
  const [pinnedJobIds, setPinnedJobIds] = useState<Set<string>>(new Set());
  const [scrollDir, setScrollDir] = useState<"down" | "up">("down");
  const lastScrollTop = useRef(0);

  // Lock
  const [lockedJobIds, setLockedJobIds] = useState<Set<string>>(new Set());

  // Help modal
  const [showHelp, setShowHelp] = useState(false);

  // Undo/Redo
  const [history, setHistory] = useState<ScoredJob[][]>([]);
  const [future, setFuture] = useState<ScoredJob[][]>([]);

  const pushAndSetRanked = useCallback((updater: (prev: ScoredJob[]) => ScoredJob[]) => {
    setRankedJobs(prev => {
      setHistory(h => [...h.slice(-50), prev]);
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

  // Mobile search expanded state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Mobile filters
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);


  // Import
  const importFileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll-to-card after boost/bury/move
  const scrollToJobIdRef = useRef<string | null>(null);

  // Flying ghost card state (boost/bury visual feedback) — queue-based for concurrent ghosts
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

  // Cascade animation state
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

  // Edge glow state
  const [edgeGlow, setEdgeGlow] = useState<{ side: 'top' | 'bottom'; color: 'green' | 'red' } | null>(null);

  // Ref for fresh state in DnD callbacks
  const rankedJobsRef = useRef(rankedJobs);
  rankedJobsRef.current = rankedJobs;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function update() { setIsMobile(window.innerWidth < 640); }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  // Sensors
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /* ── Nudge amount ── */
  const nudgeAmount = useMemo(
    () => computeNudgeAmount(rankedJobs),
    [rankedJobs]
  );

  /* ── Derived data ── */

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

  // O(1) lookup: id → global index in rankedJobs
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

  // IDs for SortableContext
  const filteredIds = useMemo(
    () => filteredJobs.map((s) => s.job.programmeTitle),
    [filteredJobs]
  );

  // Row-based virtualization
  const rowCount = filteredJobs.length;
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => isMobile ? 172 : 56,
    overscan: 5,
  });
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  // Reset scroll on filter change or view mode switch
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    virtualizer.measure();
  }, [searchQuery, regionFilter, hospitalFilter, specialtyFilter, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to card after boost/bury/move
  useEffect(() => {
    const targetId = scrollToJobIdRef.current;
    if (!targetId) return;
    scrollToJobIdRef.current = null;

    const idx = filteredJobs.findIndex((sj) => sj.job.programmeTitle === targetId);
    if (idx === -1) return;

    // Small delay to let framer-motion layout animation start
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
    });
  }, [filteredJobs, virtualizer]);

  /* ── Debounced localStorage persistence ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const json = JSON.stringify(rankedJobs);
        localStorage.setItem("fy_scored_jobs", json);
        sessionStorage.setItem("fy_scored_jobs", json);
      } catch {
        // storage full — silently ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [rankedJobs]);

  /* ── Edge glow auto-clear ── */
  useEffect(() => {
    if (!edgeGlow) return;
    const timer = setTimeout(() => setEdgeGlow(null), 2000);
    return () => clearTimeout(timer);
  }, [edgeGlow]);

  /* ── Pinned rows ── */
  const pinnedRowIndices = useMemo(() => {
    const rows: number[] = [];
    filteredJobs.forEach((sj, i) => {
      if (pinnedJobIds.has(sj.job.programmeTitle)) rows.push(i);
    });
    return rows;
  }, [filteredJobs, pinnedJobIds]);

  /* ── Custom collision detection ──
     Filter to only rendered (virtualized) items for performance. */
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

  /* ── Actions ── */

  /* ── Ghost card helper: captures card position from DOM and launches flying ghost ── */
  const launchGhost = useCallback((
    jobId: string,
    direction: 'up' | 'down',
    scored: ScoredJob,
    oldRank: number,
    fromRect: DOMRect,
    newIdx: number,
  ) => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const scrollRect = scrollEl.getBoundingClientRect();

    // Estimate where the item lands after sort
    const estRowH = isMobileRef.current ? 172 : 56;
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

    // Fire edge glow immediately for off-screen destinations
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

  /* ── Cascade animation helpers ── */

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

  const launchCascadeGhosts = useCallback((
    prevJobs: ScoredJob[],
    lo: number,
    hi: number,
    direction: 'up' | 'down',
    gapIdx: number,
  ): number => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl || lo > hi) return 0;

    const contentRect = contentEl.getBoundingClientRect();

    // Build a rect cache for all displaced items + the gap position
    const rectCache = new Map<number, DOMRect>();
    for (let i = lo; i <= hi; i++) {
      const sj = prevJobs[i];
      if (!sj) continue;
      const el = scrollEl.querySelector(`[data-job-id="${sj.job.programmeTitle}"]`);
      if (el) rectCache.set(i, el.getBoundingClientRect());
    }
    // Also cache the gap slot (the nudged card, still in DOM at opacity:0 or about to be hidden)
    const gapSj = prevJobs[gapIdx];
    if (gapSj) {
      const gapEl = scrollEl.querySelector(`[data-job-id="${gapSj.job.programmeTitle}"]`);
      if (gapEl) rectCache.set(gapIdx, gapEl.getBoundingClientRect());
    }

    const newCascades = new Map<string, CascadeGhostData>();
    let count = 0;

    // Iterate from closest-to-gap toward destination
    const indices: number[] = [];
    if (direction === 'up') {
      // Boost: gap at oldIdx, items lo..hi shift down (+1). Closest to gap = hi
      for (let i = hi; i >= lo; i--) indices.push(i);
    } else {
      // Bury: gap at oldIdx, items lo..hi shift up (-1). Closest to gap = lo
      for (let i = lo; i <= hi; i++) indices.push(i);
    }

    const totalDisplaced = hi - lo + 1;
    const staggerSec = totalDisplaced <= 3 ? 0.08 : 0.05;

    for (const idx of indices) {
      const sj = prevJobs[idx];
      if (!sj) continue;

      const fromRect = rectCache.get(idx);
      if (!fromRect) continue; // not in DOM (virtualized away)

      // Each displaced card moves to the position of its neighbor toward the gap
      // Boost (direction=up): card at idx moves to idx+1's position
      // Bury (direction=down): card at idx moves to idx-1's position
      const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
      const targetRect = rectCache.get(targetIdx);

      // Compute pixel delta — use exact DOM rects when available, fall back to zero shift
      let deltaX = 0;
      let deltaY = 0;
      if (targetRect) {
        deltaX = targetRect.left - fromRect.left;
        deltaY = targetRect.top - fromRect.top;
      }

      // Skip if no movement (both rects identical or target not found)
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

  /* ── Boost / Bury (unified) ── */
  const handleNudge = useCallback(
    (jobId: string, direction: 'up' | 'down') => {
      if (lockedJobIds.has(jobId)) return;

      // Cancel any in-progress animation
      if (pendingSortRef.current) {
        clearTimeout(pendingSortRef.current.timeoutId);
        pushAndSetRanked(() => pendingSortRef.current!.sorted);
        setHiddenJobIds(new Set());
        setGhosts(new Map());
        setCascadeGhosts(new Map());
        pendingSortRef.current = null;
      }

      const sign = direction === 'up' ? 1 : -1;

      // Capture bounding rect from DOM BEFORE React re-sorts
      const el = scrollRef.current?.querySelector(`[data-job-id="${jobId}"]`);
      const fromRect = el?.getBoundingClientRect();

      // Compute sort synchronously from ref
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

      // No movement → just apply score change
      if (oldIdx === newIdx) {
        pushAndSetRanked(() => sorted);
        return;
      }

      // Record rank delta + flash
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
      }, 2500);

      // DON'T apply sort yet — defer until animations complete
      setHiddenJobIds(new Set([jobId]));

      // Launch main ghost
      if (fromRect) {
        launchGhost(jobId, direction, scored, oldIdx + 1, fromRect, newIdx);
      }

      // Launch cascade ghosts for displaced items
      const [lo, hi] = direction === 'up'
        ? [newIdx, oldIdx - 1]   // boost: items at newIdx..oldIdx-1 shift down
        : [oldIdx + 1, newIdx];  // bury: items at oldIdx+1..newIdx shift up
      launchCascadeGhosts(prev, lo, hi, direction, oldIdx);

      // Track pending sort — main ghost completion or safety timeout triggers it
      const safetyTimeout = setTimeout(() => applyPendingSort(), 900);
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

  /* ── Move To ── */
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

  /* ── Multiselect ── */
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

  /* ── Bulk actions from toolbar ── */
  const handleBulkCompare = useCallback(() => {
    const jobs = rankedJobs
      .filter((sj) => selectedIds.has(sj.job.programmeTitle))
      .slice(0, 3)
      .map((sj) => sj.job);
    setCompareJobs(jobs);
    setShowCompare(true);
  }, [selectedIds, rankedJobs]);

  const handleBulkNudge = useCallback((direction: 'up' | 'down') => {
    const sign = direction === 'up' ? 1 : -1;
    const ids = new Set([...selectedIds].filter((id) => !lockedJobIds.has(id)));
    if (ids.size === 0) return;

    // Compute sort synchronously from ref
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
    }, 2500);

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

  /* ── Pin row ── */
  const togglePin = useCallback((jobId: string) => {
    setPinnedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  /* ── Lock row ── */
  const toggleLock = useCallback((jobId: string) => {
    setLockedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  /* ── Import handler ── */
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

  /* ── DnD handlers ── */

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Locked items cannot be dragged or displaced
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

  /* ── Scroll direction tracking for pinned rows + auto-collapse mobile filters ── */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dir = el.scrollTop > lastScrollTop.current ? "down" : "up";
    setScrollDir(dir);
    lastScrollTop.current = el.scrollTop;
    setMobileFiltersOpen(false);
  }, []);

  /* ── Overlay data ── */
  const activeScored = activeId
    ? rankedJobs.find((s) => s.job.programmeTitle === activeId) ?? null
    : null;
  const activeScoredRank = activeId ? (indexById.get(activeId) ?? 0) + 1 : 0;

  const hasActiveFilters =
    searchQuery !== "" ||
    regionFilter !== "all" ||
    hospitalFilter !== "all" ||
    specialtyFilter !== "all";

  /* ── Helper: render a single list row ── */
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

  /* ══════════════════════════════════════════
     Render
     ══════════════════════════════════════════ */

  return (
    <div className="h-screen flex flex-col bg-background">
      <WelcomeModal externalOpen={showHelp} onExternalClose={() => setShowHelp(false)} />
      <SiteHeader />

      {/* Filter bar — desktop */}
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

          {/* Export / Import */}
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

          {/* Undo / Redo */}
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

      {/* Filter bar — mobile */}
      <div className="shrink-0 border-b bg-gradient-to-r from-secondary/20 via-accent/10 to-secondary/20 px-2 py-1.5 sm:hidden">
        {mobileSearchOpen ? (
          /* Expanded search: full-width input with close button */
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
          /* Compact icon row */
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

        {/* Expanded filter dropdowns */}
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

      {/* Move To dialog (single card) */}
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

      {/* Move To dialog (bulk) */}
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

      {/* ── Main content ── */}
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
              {/* Edge glow overlay */}
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

              {/* Pinned rows at top */}
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

              {/* Scrollable area */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                onScroll={handleScroll}
              >
                <div>
                  {/* Column headers */}
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

              {/* Pinned rows at bottom */}
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

              {/* Cascade ghosts — absolutely positioned, clipped by overflow-hidden */}
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
                      duration: 0.35,
                      delay: g.delay,
                      ease: [0.25, 0.1, 0.25, 1],
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

          {/* Selection toolbar */}
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

      {/* Flying ghost cards for boost/bury visual feedback */}
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
              scale: [1, 1.05, 1],
              opacity: [1, 1, 0.7, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
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

      {/* Cascade ghosts are rendered inside contentRef container */}

      {/* Job detail overlay panel */}
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
