"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "fyrranker-welcome-seen";

interface WelcomeModalProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function WelcomeModal({ externalOpen, onExternalClose }: WelcomeModalProps) {
  const [autoOpen, setAutoOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setAutoOpen(true);
    }
    setIsMobile(window.innerWidth < 640);
  }, []);

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
          <DialogTitle className="text-xl">
            Welcome to your Ranker 🤓
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-foreground leading-relaxed overflow-y-auto flex-1">
          <p>
            This is your initial ranking, calculated from the preferences you
            set in the wizard 🧙: region, hospital, and specialty priorities all
            factored in. Use this page to fine-tune the order until it&apos;s
            exactly how you want it.
          </p>

          {isMobile ? (
            /* ── Mobile help content ── */
            <div className="space-y-2.5">
              <p className="font-semibold text-foreground">
                3 ways to manage your ranking:
              </p>
              <ol className="space-y-2 pl-1">
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">1.</span>
                  <span>
                    <strong>Swipe right</strong> to boost a programme up the ranking.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">2.</span>
                  <span>
                    <strong>Swipe left</strong> to bury it down the ranking.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">3.</span>
                  <span>
                    <strong>Press and hold</strong> to drag it to a new position.
                  </span>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">
                More features (pin, lock, multiselect, move-to) are available on desktop.
              </p>
            </div>
          ) : (
            /* ── Desktop help content ── */
            <div className="space-y-2.5">
              <p className="font-semibold text-foreground">
                6 ways to manage your ranking:
              </p>
              <ol className="space-y-2 pl-1">
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">1.</span>
                  <span>
                    <strong>Drag & drop</strong>: grab any card and move it
                    directly where you want it.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">2.</span>
                  <span>
                    <strong>Boost & bury</strong>: use the{" "}
                    <span className="text-emerald-400 font-bold">&#9650;</span>{" "}
                    <span className="text-red-400 font-bold">&#9660;</span>{" "}
                    triangles to nudge a programme&apos;s score up or down in the ranking*.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">3.</span>
                  <span>
                    <strong>Move to</strong>: click the arrow icon on a card to
                    jump it to a specific rank, or send it straight to the top or
                    bottom.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">4.</span>
                  <span>
                    <strong>Multiselect</strong>: select multiple cards using the
                    circle in the top-right corner, then apply any of the above
                    actions to all of them at once.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">5.</span>
                  <span>
                    <strong>Pin</strong>: pin a row to keep it visible at the top
                    or bottom of the screen while you scroll — great for comparing
                    against a fixed reference.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="shrink-0 font-semibold text-foreground">6.</span>
                  <span>
                    <strong>Lock</strong>: lock a row to freeze it in place.
                    Locked rows can&apos;t be moved by drag-and-drop, boost/bury,
                    or move-to.
                  </span>
                </li>
              </ol>
            </div>
          )}

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

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Cheers pal 👍
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
