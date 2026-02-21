"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "fyrranker-welcome-seen";
const MOBILE_BREAKPOINT = 640;

interface WelcomeModalProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

function subscribeToResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}
function getIsMobile() {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}
function getServerIsMobile() {
  return false;
}

function InstructionItem({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="shrink-0 font-semibold text-foreground">{num}.</span>
      <span>{children}</span>
    </li>
  );
}

function MobileInstructions() {
  return (
    <div className="space-y-2.5">
      <p className="font-semibold text-foreground">3 ways to manage your ranking:</p>
      <ol className="space-y-2 pl-1">
        <InstructionItem num={1}><strong>Swipe right</strong> to boost a programme up the ranking.</InstructionItem>
        <InstructionItem num={2}><strong>Swipe left</strong> to bury it down the ranking.</InstructionItem>
        <InstructionItem num={3}><strong>Press and hold</strong> to drag it to a new position.</InstructionItem>
      </ol>
      <p className="text-xs text-muted-foreground">
        More features (pin, lock, multiselect, move-to) are available on desktop.
      </p>
    </div>
  );
}

function DesktopInstructions() {
  return (
    <div className="space-y-2.5">
      <p className="font-semibold text-foreground">6 ways to manage your ranking:</p>
      <ol className="space-y-2 pl-1">
        <InstructionItem num={1}><strong>Drag & drop</strong>: grab any card and move it directly where you want it.</InstructionItem>
        <InstructionItem num={2}>
          <strong>Boost & bury</strong>: use the{" "}
          <span className="text-emerald-400 font-bold">&#9650;</span>{" "}
          <span className="text-red-400 font-bold">&#9660;</span>{" "}
          triangles to nudge a programme&apos;s score up or down in the ranking*.
        </InstructionItem>
        <InstructionItem num={3}><strong>Move to</strong>: click the arrow icon on a card to jump it to a specific rank, or send it straight to the top or bottom.</InstructionItem>
        <InstructionItem num={4}><strong>Multiselect</strong>: select multiple cards using the circle in the top-right corner, then apply any of the above actions to all of them at once.</InstructionItem>
        <InstructionItem num={5}><strong>Pin</strong>: pin a row to keep it visible at the top or bottom of the screen while you scroll — great for comparing against a fixed reference.</InstructionItem>
        <InstructionItem num={6}><strong>Lock</strong>: lock a row to freeze it in place. Locked rows can&apos;t be moved by drag-and-drop, boost/bury, or move-to.</InstructionItem>
      </ol>
    </div>
  );
}

function ModalBody({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="space-y-4 text-sm text-foreground leading-relaxed overflow-y-auto flex-1">
      <p>
        This is your initial ranking, calculated from the preferences you
        set in the wizard: region, hospital, and specialty priorities all
        factored in. Use this page to fine-tune the order until it&apos;s
        exactly how you want it.
      </p>
      {isMobile ? <MobileInstructions /> : <DesktopInstructions />}
      <p>
        You can filter by region, hospital, or specialty to focus on a
        subset, however any changes you make still apply to the global ranking.
      </p>
      {!isMobile && (
        <small className="text-xs text-muted-foreground">
          *The amount the score is nudged by is fixed, but the number of places it moves depends on
          how close the scores are in the surrounding programmes.
        </small>
      )}
    </div>
  );
}

export function WelcomeModal({ externalOpen, onExternalClose }: WelcomeModalProps) {
  const [autoOpen, setAutoOpen] = useState(() =>
    typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)
  );
  const isMobile = useSyncExternalStore(subscribeToResize, getIsMobile, getServerIsMobile);
  const open = autoOpen || (externalOpen ?? false);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, "1");
    setAutoOpen(false);
    onExternalClose?.();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to your Ranker</DialogTitle>
        </DialogHeader>
        <ModalBody isMobile={isMobile} />
        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Cheers pal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
