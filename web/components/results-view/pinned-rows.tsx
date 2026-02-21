"use client";

import type { Job } from "@/lib/parse-xlsx";
import { ListRow } from "@/components/results-view/list-row";
import { cn } from "@/lib/utils";
import type { RowData } from "@/components/results-view/row-data";

interface PinnedRowsProps {
  position: "top" | "bottom";
  pinnedRowIndices: number[];
  isMobile: boolean;
  getRowData: (jobIndex: number) => RowData | null;
  onSelectDetail: (job: Job) => void;
  onToggleSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleLock: (id: string) => void;
  onBoost: (id: string) => void;
  onBury: (id: string) => void;
  onMoveToOpen: (id: string, rank: number) => void;
}

function PinnedRow(props: {
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

export function PinnedRows(props: PinnedRowsProps): React.ReactNode {
  if (props.pinnedRowIndices.length === 0) return null;

  const containerClass =
    props.position === "top"
      ? "shrink-0 z-10 shadow-md border-b max-h-[30vh] overflow-y-auto"
      : "shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0_0_0/0.1)] border-t max-h-[30vh] overflow-y-auto";

  return (
    <div className={containerClass}>
      {props.pinnedRowIndices.map((jobIdx) => {
        const data = props.getRowData(jobIdx);
        if (!data) return null;
        return (
          <div key={`pin-${jobIdx}`} className={cn(!props.isMobile && (jobIdx % 2 === 0 ? "bg-row-even" : "bg-row-odd"))}>
            <PinnedRow data={data} isMobile={props.isMobile} onSelectDetail={props.onSelectDetail} onToggleSelect={props.onToggleSelect} onTogglePin={props.onTogglePin} onToggleLock={props.onToggleLock} onBoost={props.onBoost} onBury={props.onBury} onMoveToOpen={props.onMoveToOpen} />
          </div>
        );
      })}
    </div>
  );
}
