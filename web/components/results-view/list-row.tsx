"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
} from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore } from "@/lib/scoring";
import type { Job } from "@/lib/parse-xlsx";
import { getJobPlacements, type PlacementEntry } from "@/lib/parse-xlsx";
import { getRegionStyle } from "@/components/job-detail-panel";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  Pin,
  Lock,
} from "lucide-react";

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
  const displayRef = useRef(value);
  const flashKey = useRef(0);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    const start = displayRef.current;
    const end = value;
    if (Math.abs(start - end) < 0.0001) return;

    const duration = 700;
    const startTime = performance.now();

    if (animRef.current) cancelAnimationFrame(animRef.current);

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (end - start) * eased;
      displayRef.current = next;
      setDisplayValue(next);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    }
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value]);

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
    if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 10) {
      ref.aborted = true;
      setSwipeX(0);
      setPendingAction(null);
      return;
    }
    if (Math.abs(dx) > 10) {
      setSwipeX(dx);
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

  const allPlacements: (PlacementEntry | null)[] = [];
  for (let i = 0; i < 3; i++) allPlacements.push(fy1[i] ?? null);
  for (let i = 0; i < 3; i++) allPlacements.push(fy2[i] ?? null);

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

        <motion.div
          className={cn("relative flex flex-col py-2 px-2.5 bg-card rounded-xl", washClass)}
          animate={{ x: swipeX }}
          transition={swipeX === 0 ? { type: "spring", stiffness: 500, damping: 30 } : { duration: 0 }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
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
      <div className="flex items-center justify-end gap-1 pr-2">
        <RankChangeBadge delta={rankDelta} direction={flashDirection} />
        <span className="text-sm font-bold font-mono text-foreground">
          {rank}
        </span>
      </div>

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
          <AnimatedScore value={score} flashDirection={flashDirection} />
        </div>
      </div>

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

export { ListRow, ListDragOverlayRow, PlacementList };
