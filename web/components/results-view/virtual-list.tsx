"use client";

import type { Virtualizer } from "@tanstack/react-virtual";
import type { ScoredJob } from "@/lib/scoring";
import type { Job } from "@/lib/parse-xlsx";
import { ListRow } from "@/components/results-view/list-row";
import { cn } from "@/lib/utils";
import type { RowData } from "@/components/results-view/row-data";

function RenderListRow(props: {
  data: RowData;
  isMobile: boolean;
  onSelectDetail: (job: Job) => void;
  onToggleSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleLock: (id: string) => void;
  onBoost: (id: string) => void;
  onBury: (id: string) => void;
  onMoveToOpen: (id: string, rank: number) => void;
}): React.ReactNode {
  const { data } = props;
  return (
    <div style={data.isHidden ? { opacity: 0 } : undefined}>
      <ListRow
        key={data.scored.job.programmeTitle}
        scored={data.scored}
        rank={data.globalIdx + 1}
        isSelected={data.isSelected}
        isDetailOpen={data.isDetailOpen}
        isPinned={data.isPinned}
        isLocked={data.isLocked}
        isMobile={props.isMobile}
        onSelectDetail={props.onSelectDetail}
        onToggleSelect={props.onToggleSelect}
        onTogglePin={props.onTogglePin}
        onToggleLock={props.onToggleLock}
        onBoost={props.onBoost}
        onBury={props.onBury}
        onMoveToOpen={props.onMoveToOpen}
        flashDirection={data.flashDirection}
        glowKey={0}
        rankDelta={data.rankDelta}
      />
    </div>
  );
}

export interface VirtualListProps {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  filteredJobs: ScoredJob[];
  rankedJobsLength: number;
  isMobile: boolean;
  getRowData: (jobIndex: number) => RowData | null;
  onSelectDetail: (job: Job) => void;
  onToggleSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleLock: (id: string) => void;
  onBoost: (id: string) => void;
  onBury: (id: string) => void;
  onMoveToOpen: (id: string, rank: number) => void;
  onClearFilters: () => void;
}

function VirtualRow(props: {
  virtualRow: { index: number; size: number; start: number };
  isMobile: boolean;
  getRowData: (i: number) => RowData | null;
  listProps: VirtualListProps;
}): React.ReactNode {
  const data = props.getRowData(props.virtualRow.index);
  if (!data) return null;
  const isEvenRow = props.virtualRow.index % 2 === 0;
  return (
    <div
      className={cn("absolute left-0 right-0", !props.isMobile && (isEvenRow ? "bg-row-even" : "bg-row-odd"))}
      style={{ height: `${props.virtualRow.size}px`, transform: `translateY(${props.virtualRow.start}px)` }}
    >
      <RenderListRow
        data={data}
        isMobile={props.isMobile}
        onSelectDetail={props.listProps.onSelectDetail}
        onToggleSelect={props.listProps.onToggleSelect}
        onTogglePin={props.listProps.onTogglePin}
        onToggleLock={props.listProps.onToggleLock}
        onBoost={props.listProps.onBoost}
        onBury={props.listProps.onBury}
        onMoveToOpen={props.listProps.onMoveToOpen}
      />
    </div>
  );
}

function EmptyState(props: {
  filteredCount: number;
  totalCount: number;
  onClear: () => void;
}): React.ReactNode {
  if (props.filteredCount > 0 || props.totalCount === 0) return null;
  return (
    <div className="text-center py-12 text-muted-foreground">
      <p className="text-sm">No programmes match your filters.</p>
      <button onClick={props.onClear} className="text-xs text-primary hover:underline mt-1">
        Clear all filters
      </button>
    </div>
  );
}

export function VirtualList(props: VirtualListProps): React.ReactNode {
  return (
    <div>
      <div className="relative" style={{ height: `${props.virtualizer.getTotalSize()}px` }}>
        {props.virtualizer.getVirtualItems().map((vr) => (
          <VirtualRow key={vr.index} virtualRow={vr} isMobile={props.isMobile} getRowData={props.getRowData} listProps={props} />
        ))}
      </div>
      <EmptyState filteredCount={props.filteredJobs.length} totalCount={props.rankedJobsLength} onClear={props.onClearFilters} />
    </div>
  );
}
