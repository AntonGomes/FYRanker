"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpToLine, ArrowDownToLine } from "lucide-react";

interface MoveToDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRank: number;
  totalJobs: number;
  onMoveTo: (targetRank: number) => void;
}

function QuickMoveButtons({
  totalJobs,
  onMoveTo,
  onClose,
}: {
  totalJobs: number;
  onMoveTo: (targetRank: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="flex-1 gap-1"
        onClick={() => { onMoveTo(1); onClose(); }}
      >
        <ArrowUpToLine className="h-3.5 w-3.5" />
        Send to Top
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="flex-1 gap-1"
        onClick={() => { onMoveTo(totalJobs); onClose(); }}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        Send to Bottom
      </Button>
    </div>
  );
}

export function MoveToDialog({
  open,
  onOpenChange,
  currentRank,
  totalJobs,
  onMoveTo,
}: MoveToDialogProps) {
  const [inputValue, setInputValue] = useState(String(currentRank));
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setInputValue(String(currentRank));
  }

  function handleMove() {
    const target = Math.max(1, Math.min(Number(inputValue) || 1, totalJobs));
    onMoveTo(target);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Move to rank</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Currently ranked <span className="font-mono font-bold">#{currentRank}</span> of {totalJobs}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={totalJobs}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMove()}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring/50"
            autoFocus
          />
          <Button size="sm" onClick={handleMove}>Move</Button>
        </div>
        <QuickMoveButtons totalJobs={totalJobs} onMoveTo={onMoveTo} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
