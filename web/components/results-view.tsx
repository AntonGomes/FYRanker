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
  PointerSensor,
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
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, LayoutGroup } from "framer-motion";
import type { ScoredJob } from "@/lib/scoring";
import { effectiveScore, computeNudgeAmount } from "@/lib/scoring";
import type { Job, Placement } from "@/lib/parse-xlsx";
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
  LayoutGrid,
  List,
  Download,
  Upload,
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

function isValidPlacement(p: Placement) {
  return p.site && p.site !== "None" && p.site.trim() !== "";
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

type PlacementEntry = { site: string; spec: string; num: number };

function getJobPlacements(job: Job): {
  fy1: PlacementEntry[];
  fy2: PlacementEntry[];
} {
  const fy1: PlacementEntry[] = [];
  const fy2: PlacementEntry[] = [];
  for (let i = 0; i < job.placements.length; i++) {
    const p = job.placements[i];
    if (isValidPlacement(p)) {
      const entry = { site: p.site, spec: p.specialty, num: i + 1 };
      if (i < 3) fy1.push(entry);
      else fy2.push(entry);
    }
  }
  return { fy1, fy2 };
}

/* ── Responsive cards-per-row hook ── */

function useCardsPerRow() {
  const [count, setCount] = useState(5);
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 640) setCount(1);
      else if (w < 1024) setCount(3);
      else setCount(5);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return count;
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
    const timeout = setTimeout(() => setFlashClass(""), 900);
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
          {entry.site}
        </p>
        <p className="text-xs font-medium text-muted-foreground leading-tight truncate">
          {entry.spec}
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
            <div key={i} className="h-[30px]" />
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

/* ── Sortable job card ── */
const JobCard = memo(function JobCard({
  scored,
  rank,
  isSelected,
  onSelectDetail,
  onToggleSelect,
  onBoost,
  onBury,
  onMoveToOpen,
  flashDirection,
  glowKey,
}: {
  scored: ScoredJob;
  rank: number;
  isSelected: boolean;
  onSelectDetail: (job: Job) => void;
  onToggleSelect: (jobId: string) => void;
  onBoost: (jobId: string) => void;
  onBury: (jobId: string) => void;
  onMoveToOpen: (jobId: string, rank: number) => void;
  flashDirection: "up" | "down" | null;
  glowKey: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scored.job.programmeTitle });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const regionStyle = getRegionStyle(scored.job.region);
  const { fy1, fy2 } = getJobPlacements(scored.job);
  const score = effectiveScore(scored);

  // Use glowKey to force re-mount of the glow wrapper so CSS animation replays
  const glowClass =
    flashDirection === "up"
      ? "animate-card-glow-up"
      : flashDirection === "down"
        ? "animate-card-glow-down"
        : "";

  return (
    <motion.div
      layoutId={scored.job.programmeTitle}
      layout="position"
      transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
    >
      <div
        key={glowKey}
        ref={setNodeRef}
        style={{
          ...style,
          boxShadow: isSelected
            ? `0 1px 3px ${regionStyle.color}15`
            : `0 2px 8px ${regionStyle.color}20, 0 1px 3px rgba(0,0,0,0.06)`,
        }}
        {...attributes}
        {...listeners}
        className={cn(
          "group rounded-lg border-0 hover:bg-card-hover hover:-translate-y-0.5 transition-all duration-150 cursor-grab touch-none flex flex-col bg-card",
          isSelected && "ring-2 ring-primary/60 bg-card-selected",
          isDragging && "opacity-40 z-50",
          glowClass
        )}
        onClick={() => onSelectDetail(scored.job)}
      >
        {/* ── Header row ── */}
        <div className="flex items-center gap-1.5 px-2 pt-2 pb-1.5 border-b border-border">
          {/* Rank number */}
          <span className="text-sm font-bold font-mono text-foreground shrink-0">
            {rank}
          </span>

          {/* Region badge */}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold border shrink-0 ml-1.5",
              regionStyle.bg,
              regionStyle.text,
              regionStyle.border
            )}
          >
            {scored.job.region}
          </span>

          {/* Programme title */}
          <span className="flex-1 text-xs font-mono font-medium text-foreground truncate min-w-0 ml-0.5">
            {scored.job.programmeTitle}
          </span>

          {/* Move to button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveToOpen(scored.job.programmeTitle, rank);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 -m-1 rounded-md transition-colors shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            title="Move to..."
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>

          {/* Select circle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(scored.job.programmeTitle);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 -m-1 shrink-0 flex items-center justify-center"
            title={isSelected ? "Deselect" : "Select"}
          >
            <div
              className={cn(
                "h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-colors",
                isSelected
                  ? "bg-primary border-primary"
                  : "border-muted-foreground hover:border-primary"
              )}
            >
              {isSelected && (
                <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              )}
            </div>
          </button>
        </div>

        {/* ── Body: Placement list ── */}
        <div className="px-2.5 py-1.5 flex-1">
          <PlacementList fy1={fy1} fy2={fy2} />
        </div>

        {/* ── Footer: Score box + Boost/Bury triangles ── */}
        <div className="px-2 pb-1.5 pt-1 border-t border-border flex items-center justify-end gap-1.5">
          <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Score
            </span>
            <AnimatedScore value={score} flashDirection={flashDirection} />
          </div>

          {/* Boost / Bury arrows */}
          <div className="flex shrink-0 gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBoost(scored.job.programmeTitle);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 rounded text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 active:scale-90 transition-all"
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
              className="p-1 rounded text-red-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all"
              title="Bury"
            >
              <ArrowDown />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* ── Drag overlay card (non-interactive copy shown while dragging) ── */
const DragOverlayCard = memo(function DragOverlayCard({
  scored,
  rank,
  width,
}: {
  scored: ScoredJob;
  rank: number;
  width?: number;
}) {
  const regionStyle = getRegionStyle(scored.job.region);
  const { fy1, fy2 } = getJobPlacements(scored.job);

  return (
    <div
      className="rounded-lg border-0 bg-card-drag ring-2 ring-primary/30 scale-[1.02]"
      style={{
        ...(width ? { width } : {}),
        boxShadow: `0 8px 24px ${regionStyle.color}30, 0 4px 12px rgba(0,0,0,0.1)`,
      }}
    >
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1.5 border-b border-border">
        <span className="text-sm font-bold font-mono text-foreground shrink-0">
          {rank}
        </span>
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
        <span className="flex-1 text-xs font-mono font-medium text-foreground truncate min-w-0">
          {scored.job.programmeTitle}
        </span>
      </div>
      <div className="px-2.5 py-1.5">
        <PlacementList fy1={fy1} fy2={fy2} />
      </div>
    </div>
  );
});

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
}: {
  scored: ScoredJob;
  rank: number;
  isSelected: boolean;
  isPinned: boolean;
  isLocked: boolean;
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

  const glowClass =
    flashDirection === "up"
      ? "animate-card-glow-up"
      : flashDirection === "down"
        ? "animate-card-glow-down"
        : "";

  // Build placement array for all 6 slots
  const allPlacements: (PlacementEntry | null)[] = [];
  for (let i = 0; i < 3; i++) allPlacements.push(fy1[i] ?? null);
  for (let i = 0; i < 3; i++) allPlacements.push(fy2[i] ?? null);

  // Build compact placement summary for mobile
  const mobilePlacementSummary = useMemo(() => {
    const entries = allPlacements.filter((e): e is PlacementEntry => e !== null);
    return entries
      .slice(0, 3)
      .map((e) => `${e.site} · ${e.spec}`)
      .join(" , ");
  }, [allPlacements]);

  if (isMobile) {
    return (
      <div
        key={glowKey}
        ref={setNodeRef}
        style={{
          ...style,
          boxShadow: isSelected
            ? undefined
            : `inset 3px 0 0 ${regionStyle.color}40`,
        }}
        {...attributes}
        {...listeners}
        className={cn(
          "flex flex-col py-2 px-2.5 border-b border-border transition-colors duration-100",
          isLocked ? "cursor-default" : "cursor-grab touch-none",
          isSelected
            ? "bg-card-selected ring-1 ring-primary/60"
            : "hover:bg-card-hover",
          isDragging && "opacity-40 z-50",
          isLocked && "bg-amber-50/40 dark:bg-amber-950/20",
          glowClass
        )}
        onClick={() => onSelectDetail(scored.job)}
        role="row"
      >
        {/* Line 1: rank + region + title */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold font-mono text-foreground shrink-0">
            {rank}
          </span>
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
        </div>

        {/* Line 2: compact placement summary */}
        <p className="text-[11px] text-foreground truncate mt-0.5">
          {mobilePlacementSummary || "No placements"}
        </p>

        {/* Line 3: score + actions */}
        <div className="flex items-center mt-1">
          <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Score
            </span>
            <AnimatedScore value={score} flashDirection={flashDirection} />
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onBoost(scored.job.programmeTitle); }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn("p-0.5 rounded text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 active:scale-90 transition-all", isLocked && "pointer-events-none opacity-30")}
              title="Boost"
            >
              <ArrowUp />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBury(scored.job.programmeTitle); }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn("p-0.5 rounded text-red-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all", isLocked && "pointer-events-none opacity-30")}
              title="Bury"
            >
              <ArrowDown />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToOpen(scored.job.programmeTitle, rank); }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn("p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors", isLocked && "pointer-events-none opacity-30")}
              title="Move to..."
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(scored.job.programmeTitle); }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn("p-0.5 rounded transition-colors", isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}
              title={isPinned ? "Unpin" : "Pin"}
            >
              <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-primary")} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLock(scored.job.programmeTitle); }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn("p-0.5 rounded transition-colors", isLocked ? "text-amber-500" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}
              title={isLocked ? "Unlock" : "Lock"}
            >
              <Lock className={cn("h-3.5 w-3.5", isLocked && "fill-amber-500/20")} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(scored.job.programmeTitle); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-0.5 flex items-center justify-center"
              title={isSelected ? "Deselect" : "Select"}
            >
              <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors", isSelected ? "bg-primary border-primary" : "border-muted-foreground hover:border-primary")}>
                {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      key={glowKey}
      ref={setNodeRef}
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
        "grid items-center gap-x-0.5 h-[56px] border-b border-border transition-colors duration-100",
        isLocked ? "cursor-default" : "cursor-grab touch-none",
        isSelected
          ? "bg-card-selected ring-1 ring-primary/60"
          : "hover:bg-card-hover",
        isDragging && "opacity-40 z-50",
        isLocked && "bg-amber-50/40 dark:bg-amber-950/20",
        glowClass
      )}
      onClick={() => onSelectDetail(scored.job)}
      role="row"
    >
      {/* Rank */}
      <span className="text-sm font-bold font-mono text-foreground text-right pr-2">
        {rank}
      </span>

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
                {entry.site}
              </p>
              <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate">
                {entry.spec}
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
    const placementEntries = allPlacements.filter((e): e is PlacementEntry => e !== null);
    const summary = placementEntries
      .slice(0, 3)
      .map((e) => `${e.site} · ${e.spec}`)
      .join(" , ");

    return (
      <div
        className="flex flex-col py-2 px-2.5 bg-card-drag ring-2 ring-primary/30 rounded-md"
        style={{ boxShadow: `0 8px 24px ${regionStyle.color}30, 0 4px 12px rgba(0,0,0,0.1)` }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold font-mono text-foreground shrink-0">{rank}</span>
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold border shrink-0", regionStyle.bg, regionStyle.text, regionStyle.border)}>
            {scored.job.region}
          </span>
          <span className="flex-1 text-xs font-mono font-semibold text-foreground truncate min-w-0">
            {scored.job.programmeTitle}
          </span>
        </div>
        <p className="text-[11px] text-foreground truncate mt-0.5">{summary || "No placements"}</p>
        <div className="flex items-center mt-1">
          <div className="rounded-md bg-secondary/50 px-2 py-0.5 flex items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Score</span>
            <span className="font-mono tabular-nums text-xs font-semibold text-foreground">{score.toFixed(3)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid items-center gap-x-0.5 h-[56px] bg-card-drag ring-2 ring-primary/30 rounded-md"
      style={{
        gridTemplateColumns: "40px auto minmax(100px,auto) repeat(6, minmax(90px, 1fr)) 90px 140px",
        boxShadow: `0 8px 24px ${regionStyle.color}30, 0 4px 12px rgba(0,0,0,0.1)`,
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
                {entry.site}
              </p>
              <p className="text-[11px] font-semibold italic text-foreground leading-tight truncate">
                {entry.spec}
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

  // Boost/Bury flash tracking + glow key counter for re-triggering CSS animation
  const glowKeyRef = useRef<Map<string, number>>(new Map());
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

  // View mode
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Import
  const importFileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll-to-card after boost/bury/move
  const scrollToJobIdRef = useRef<string | null>(null);

  // Ref for fresh state in DnD callbacks
  const rankedJobsRef = useRef(rankedJobs);
  rankedJobsRef.current = rankedJobs;

  const cardsPerRow = useCardsPerRow();
  const isMobile = cardsPerRow === 1;

  // Force list view on mobile
  useEffect(() => {
    if (isMobile) setViewMode("list");
  }, [isMobile]);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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

  // IDs for SortableContext
  const filteredIds = useMemo(
    () => filteredJobs.map((s) => s.job.programmeTitle),
    [filteredJobs]
  );

  // Row-based virtualization
  const rowCount = viewMode === "list"
    ? filteredJobs.length
    : Math.ceil(filteredJobs.length / cardsPerRow);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => viewMode === "list" ? (isMobile ? 88 : 56) : 340,
    overscan: viewMode === "list" ? 5 : 2,
  });

  // Reset scroll on filter change or view mode switch
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    virtualizer.measure();
  }, [searchQuery, regionFilter, hospitalFilter, specialtyFilter, viewMode, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to card after boost/bury/move
  useEffect(() => {
    const targetId = scrollToJobIdRef.current;
    if (!targetId) return;
    scrollToJobIdRef.current = null;

    const idx = filteredJobs.findIndex((sj) => sj.job.programmeTitle === targetId);
    if (idx === -1) return;
    const rowIdx = viewMode === "list" ? idx : Math.floor(idx / cardsPerRow);

    // Small delay to let framer-motion layout animation start
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(rowIdx, { align: "center", behavior: "smooth" });
    });
  }, [filteredJobs, cardsPerRow, virtualizer]);

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

  /* ── Pinned rows ── */
  const pinnedRowIndices = useMemo(() => {
    const rows: number[] = [];
    if (viewMode === "list") {
      filteredJobs.forEach((sj, i) => {
        if (pinnedJobIds.has(sj.job.programmeTitle)) rows.push(i);
      });
    } else {
      for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
        const start = rowIdx * cardsPerRow;
        const end = Math.min(start + cardsPerRow, filteredJobs.length);
        for (let i = start; i < end; i++) {
          if (pinnedJobIds.has(filteredJobs[i].job.programmeTitle)) {
            rows.push(rowIdx);
            break;
          }
        }
      }
    }
    return rows;
  }, [filteredJobs, pinnedJobIds, cardsPerRow, rowCount, viewMode]);

  /* ── Custom collision detection ──
     Filter to only rendered (virtualized) items for performance. */
  const customCollisionDetection: CollisionDetection = useCallback(
    (args) => {
      const virtualItems = virtualizer.getVirtualItems();
      const visibleIds = new Set<string>();
      virtualItems.forEach((vRow) => {
        if (viewMode === "list") {
          visibleIds.add(filteredJobs[vRow.index]?.job.programmeTitle);
        } else {
          const start = vRow.index * cardsPerRow;
          const end = Math.min(start + cardsPerRow, filteredJobs.length);
          for (let i = start; i < end; i++) {
            visibleIds.add(filteredJobs[i].job.programmeTitle);
          }
        }
      });

      const filtered = args.droppableContainers.filter((dc) =>
        visibleIds.has(dc.id as string)
      );

      if (filtered.length === 0) {
        return closestCenter(args);
      }

      return closestCenter({ ...args, droppableContainers: filtered });
    },
    [virtualizer, filteredJobs, cardsPerRow, viewMode]
  );

  /* ── Actions ── */

  /* ── Boost / Bury ── */
  const handleBoost = useCallback(
    (jobId: string) => {
      if (lockedJobIds.has(jobId)) return;
      scrollToJobIdRef.current = jobId;
      glowKeyRef.current.set(jobId, (glowKeyRef.current.get(jobId) ?? 0) + 1);
      setFlashMap((prev) => {
        const next = new Map(prev);
        next.set(jobId, "up");
        return next;
      });
      setTimeout(() => {
        setFlashMap((prev) => {
          const next = new Map(prev);
          next.delete(jobId);
          return next;
        });
      }, 6200);

      setRankedJobs((prev) => {
        const updated = prev.map((sj) =>
          sj.job.programmeTitle === jobId
            ? { ...sj, scoreAdjustment: (sj.scoreAdjustment ?? 0) + nudgeAmount }
            : sj
        );
        return [...updated].sort(
          (a, b) => effectiveScore(b) - effectiveScore(a)
        );
      });
    },
    [nudgeAmount, lockedJobIds]
  );

  const handleBury = useCallback(
    (jobId: string) => {
      if (lockedJobIds.has(jobId)) return;
      scrollToJobIdRef.current = jobId;
      glowKeyRef.current.set(jobId, (glowKeyRef.current.get(jobId) ?? 0) + 1);
      setFlashMap((prev) => {
        const next = new Map(prev);
        next.set(jobId, "down");
        return next;
      });
      setTimeout(() => {
        setFlashMap((prev) => {
          const next = new Map(prev);
          next.delete(jobId);
          return next;
        });
      }, 6200);

      setRankedJobs((prev) => {
        const updated = prev.map((sj) =>
          sj.job.programmeTitle === jobId
            ? { ...sj, scoreAdjustment: (sj.scoreAdjustment ?? 0) - nudgeAmount }
            : sj
        );
        return [...updated].sort(
          (a, b) => effectiveScore(b) - effectiveScore(a)
        );
      });
    },
    [nudgeAmount, lockedJobIds]
  );

  /* ── Move To ── */
  const handleMoveTo = useCallback((jobId: string, targetRank: number) => {
    if (lockedJobIds.has(jobId)) return;
    scrollToJobIdRef.current = jobId;
    setRankedJobs((prev) => {
      const currentIdx = prev.findIndex((sj) => sj.job.programmeTitle === jobId);
      if (currentIdx === -1) return prev;
      const targetIdx = Math.max(
        0,
        Math.min(targetRank - 1, prev.length - 1)
      );
      return arrayMove(prev, currentIdx, targetIdx);
    });
  }, [lockedJobIds]);

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
      const start = rowIndex * cardsPerRow;
      const end = Math.min(start + cardsPerRow, filteredJobs.length);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const rowIds = filteredJobs.slice(start, end).map((sj) => sj.job.programmeTitle);
        const allSelected = rowIds.every((id) => prev.has(id));
        if (allSelected) rowIds.forEach((id) => next.delete(id));
        else rowIds.forEach((id) => next.add(id));
        return next;
      });
    },
    [cardsPerRow, filteredJobs]
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

  const handleBulkBoost = useCallback(() => {
    const ids = new Set([...selectedIds].filter((id) => !lockedJobIds.has(id)));
    if (ids.size === 0) return;
    ids.forEach((id) => glowKeyRef.current.set(id, (glowKeyRef.current.get(id) ?? 0) + 1));
    setFlashMap(() => {
      const next = new Map<string, "up" | "down">();
      ids.forEach((id) => next.set(id, "up"));
      return next;
    });
    setTimeout(() => setFlashMap(new Map()), 6200);

    setRankedJobs((prev) => {
      const updated = prev.map((sj) =>
        ids.has(sj.job.programmeTitle)
          ? { ...sj, scoreAdjustment: (sj.scoreAdjustment ?? 0) + nudgeAmount }
          : sj
      );
      return [...updated].sort(
        (a, b) => effectiveScore(b) - effectiveScore(a)
      );
    });
  }, [selectedIds, nudgeAmount, lockedJobIds]);

  const handleBulkBury = useCallback(() => {
    const ids = new Set([...selectedIds].filter((id) => !lockedJobIds.has(id)));
    if (ids.size === 0) return;
    ids.forEach((id) => glowKeyRef.current.set(id, (glowKeyRef.current.get(id) ?? 0) + 1));
    setFlashMap(() => {
      const next = new Map<string, "up" | "down">();
      ids.forEach((id) => next.set(id, "down"));
      return next;
    });
    setTimeout(() => setFlashMap(new Map()), 6200);

    setRankedJobs((prev) => {
      const updated = prev.map((sj) =>
        ids.has(sj.job.programmeTitle)
          ? { ...sj, scoreAdjustment: (sj.scoreAdjustment ?? 0) - nudgeAmount }
          : sj
      );
      return [...updated].sort(
        (a, b) => effectiveScore(b) - effectiveScore(a)
      );
    });
  }, [selectedIds, nudgeAmount, lockedJobIds]);

  const handleBulkMoveTo = useCallback(
    (targetRank: number) => {
      setRankedJobs((prev) => {
        // Collect selected & unlocked jobs in their current relative order
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
    [selectedIds, lockedJobIds]
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

  const [dragWidth, setDragWidth] = useState<number | undefined>();

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    setDragWidth(event.active.rect.current.translated?.width);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Locked items cannot be dragged or displaced
    if (lockedJobIds.has(activeIdStr) || lockedJobIds.has(overIdStr)) return;

    setRankedJobs((prev) => {
      const oldIndex = prev.findIndex((s) => s.job.programmeTitle === activeIdStr);
      const newIndex = prev.findIndex((s) => s.job.programmeTitle === overIdStr);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)
        return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);

      // Match the moved card's score to its neighbor
      const moved = reordered[newIndex];
      let targetScore: number;
      if (newIndex === 0) {
        // First position: match the card below
        targetScore = effectiveScore(reordered[1]);
      } else {
        // Otherwise: match the card above
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

  /* ── Scroll direction tracking for pinned rows ── */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dir = el.scrollTop > lastScrollTop.current ? "down" : "up";
    setScrollDir(dir);
    lastScrollTop.current = el.scrollTop;
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

  /* ── Helper: render a row of cards ── */
  function renderRowCards(rowIndex: number) {
    const startIdx = rowIndex * cardsPerRow;
    const rowCards = filteredJobs.slice(startIdx, startIdx + cardsPerRow);

    return (
      <div
        className="grid gap-3 w-full"
        style={{
          gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))`,
        }}
      >
        {rowCards.map((s) => {
          const globalIdx = indexById.get(s.job.programmeTitle) ?? 0;
          return (
            <JobCard
              key={s.job.programmeTitle}
              scored={s}
              rank={globalIdx + 1}
              isSelected={selectedIds.has(s.job.programmeTitle)}
              onSelectDetail={setSelectedDetail}
              onToggleSelect={toggleSelect}
              onBoost={handleBoost}
              onBury={handleBury}
              onMoveToOpen={openMoveTo}
              flashDirection={flashMap.get(s.job.programmeTitle) ?? null}
              glowKey={glowKeyRef.current.get(s.job.programmeTitle) ?? 0}
            />
          );
        })}
      </div>
    );
  }

  /* ── Helper: render a single list row ── */
  function renderListRow(jobIndex: number) {
    const s = filteredJobs[jobIndex];
    if (!s) return null;
    const globalIdx = indexById.get(s.job.programmeTitle) ?? 0;
    return (
      <ListRow
        key={s.job.programmeTitle}
        scored={s}
        rank={globalIdx + 1}
        isSelected={selectedIds.has(s.job.programmeTitle)}
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
        glowKey={glowKeyRef.current.get(s.job.programmeTitle) ?? 0}
      />
    );
  }

  /* ══════════════════════════════════════════
     Render
     ══════════════════════════════════════════ */

  return (
    <div className="h-screen flex flex-col bg-background">
      <WelcomeModal externalOpen={showHelp} onExternalClose={() => setShowHelp(false)} />
      <SiteHeader />

      {/* Filter bar */}
      <div className="shrink-0 border-b bg-gradient-to-r from-secondary/20 via-accent/10 to-secondary/20 px-4 py-3">
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

          {/* View mode toggle */}
          <div className="hidden sm:flex items-center rounded-md border bg-background p-0.5 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
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
            strategy={viewMode === "list" ? verticalListSortingStrategy : rectSortingStrategy}
          >
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Pinned rows at top */}
              {pinnedRowIndices.length > 0 &&
                scrollDir === "down" && (
                  <div className="shrink-0 z-10 shadow-md border-b max-h-[30vh] overflow-y-auto">
                    {viewMode === "list"
                      ? pinnedRowIndices.map((jobIdx) => (
                          <div key={`pin-${jobIdx}`} className={cn(jobIdx % 2 === 0 ? "bg-row-even" : "bg-row-odd")}>
                            {renderListRow(jobIdx)}
                          </div>
                        ))
                      : pinnedRowIndices.map((rowIdx) => {
                          const startIdx = rowIdx * cardsPerRow;
                          const isEvenRow = rowIdx % 2 === 0;
                          return (
                            <div
                              key={`pin-${rowIdx}`}
                              className={cn(
                                "flex border-b border-sheet-border",
                                isEvenRow ? "bg-row-even" : "bg-row-odd"
                              )}
                            >
                              <div className="w-5 shrink-0 relative border-r border-sheet-border bg-sheet-border/20">
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                  <span
                                    className="text-[9px] font-mono text-muted-foreground select-none whitespace-nowrap"
                                    style={{
                                      transform: "rotate(-90deg)",
                                    }}
                                  >
                                    {startIdx + 1}–
                                    {Math.min(
                                      startIdx + cardsPerRow,
                                      filteredJobs.length
                                    )}
                                  </span>
                                  <Pin className="h-2.5 w-2.5 text-primary fill-primary" />
                                </div>
                              </div>
                              <div className="flex-1 px-3 py-3 flex items-center">
                                <LayoutGroup>
                                  {renderRowCards(rowIdx)}
                                </LayoutGroup>
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                )}

              {/* Scrollable area */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                onScroll={handleScroll}
              >
                {viewMode === "list" ? (
                  /* ── List mode ── */
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
                            isEvenRow ? "bg-row-even" : "bg-row-odd"
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
                ) : (
                  /* ── Grid mode ── */
                  <LayoutGroup>
                    <div
                      className="relative"
                      style={{ height: `${virtualizer.getTotalSize()}px` }}
                    >
                      {virtualizer.getVirtualItems().map((virtualRow) => {
                        const startIdx = virtualRow.index * cardsPerRow;
                        const isEvenRow = virtualRow.index % 2 === 0;
                        const rowIsPinned = pinnedRowIndices.includes(
                          virtualRow.index
                        );

                        // Check if all cards in this row are selected
                        const rowCards = filteredJobs.slice(
                          startIdx,
                          startIdx + cardsPerRow
                        );
                        const allRowSelected =
                          rowCards.length > 0 &&
                          rowCards.every((s) => selectedIds.has(s.job.programmeTitle));

                        return (
                          <div
                            key={virtualRow.index}
                            className={cn(
                              "absolute left-0 right-0 flex border-b border-sheet-border",
                              isEvenRow ? "bg-row-even" : "bg-row-odd"
                            )}
                            style={{
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            {/* Row gutter: row number + pin + row select */}
                            <div
                              className="w-5 shrink-0 relative border-r border-sheet-border bg-sheet-border/20 cursor-pointer hover:bg-sheet-border/20 transition-colors group/gutter"
                              onClick={() => selectRow(virtualRow.index)}
                            >
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                <span
                                  className="text-[9px] font-mono text-muted-foreground select-none whitespace-nowrap"
                                  style={{
                                    transform: "rotate(-90deg)",
                                  }}
                                >
                                  {startIdx + 1}–
                                  {Math.min(
                                    startIdx + cardsPerRow,
                                    filteredJobs.length
                                  )}
                                </span>
                              </div>

                              {/* Row select indicator */}
                              {allRowSelected && (
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-primary" />
                              )}

                              {/* Pin button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstJob = filteredJobs[startIdx];
                                  if (firstJob) togglePin(firstJob.job.programmeTitle);
                                }}
                                className={cn(
                                  "absolute bottom-1 left-1/2 -translate-x-1/2 transition-opacity",
                                  rowIsPinned
                                    ? "opacity-100 text-primary"
                                    : "opacity-0 group-hover/gutter:opacity-60 text-muted-foreground hover:text-foreground"
                                )}
                                title={rowIsPinned ? "Unpin row" : "Pin row"}
                              >
                                <Pin
                                  className={cn(
                                    "h-2.5 w-2.5",
                                    rowIsPinned && "fill-primary"
                                  )}
                                />
                              </button>
                            </div>

                            {/* Cards */}
                            <div className="flex-1 px-3 py-3 flex items-center">
                              {renderRowCards(virtualRow.index)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </LayoutGroup>
                )}

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
                    {viewMode === "list"
                      ? pinnedRowIndices.map((jobIdx) => (
                          <div key={`pin-${jobIdx}`} className={cn(jobIdx % 2 === 0 ? "bg-row-even" : "bg-row-odd")}>
                            {renderListRow(jobIdx)}
                          </div>
                        ))
                      : pinnedRowIndices.map((rowIdx) => {
                          const startIdx = rowIdx * cardsPerRow;
                          const isEvenRow = rowIdx % 2 === 0;
                          return (
                            <div
                              key={`pin-${rowIdx}`}
                              className={cn(
                                "flex border-b border-sheet-border",
                                isEvenRow ? "bg-row-even" : "bg-row-odd"
                              )}
                            >
                              <div className="w-5 shrink-0 relative border-r border-sheet-border bg-sheet-border/20">
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                  <span
                                    className="text-[9px] font-mono text-muted-foreground select-none whitespace-nowrap"
                                    style={{
                                      transform: "rotate(-90deg)",
                                    }}
                                  >
                                    {startIdx + 1}–
                                    {Math.min(
                                      startIdx + cardsPerRow,
                                      filteredJobs.length
                                    )}
                                  </span>
                                  <Pin className="h-2.5 w-2.5 text-primary fill-primary" />
                                </div>
                              </div>
                              <div className="flex-1 px-3 py-3 flex items-center">
                                <LayoutGroup>
                                  {renderRowCards(rowIdx)}
                                </LayoutGroup>
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                )}
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
            viewMode === "list" ? (
              <ListDragOverlayRow
                scored={activeScored}
                rank={activeScoredRank}
                isMobile={isMobile}
              />
            ) : (
              <DragOverlayCard
                scored={activeScored}
                rank={activeScoredRank}
                width={dragWidth}
              />
            )
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
