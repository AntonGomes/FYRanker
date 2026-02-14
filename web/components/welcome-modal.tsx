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

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setAutoOpen(true);
    }
  }, []);

  const open = autoOpen || (externalOpen ?? false);

  function handleClose() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setAutoOpen(false);
    onExternalClose?.();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Welcome to your Ranker 🤓
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <p>
            This is your initial ranking, calculated from the preferences you
            set in the wizard 🧙: region, hospital, and specialty priorities all
            factored in. Use this page to fine-tune the order until it&apos;s
            exactly how you want it.
          </p>

          <div className="space-y-2.5">
            <p className="font-semibold text-foreground">
              4 ways to reorder:
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
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">&#9650;</span>{" "}
                  <span className="text-red-500 dark:text-red-400 font-bold">&#9660;</span>{" "}
                  triangles to nudge a programme's score up or down in the ranking*.                 </span>
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
            </ol>
                          </div>

          <p>
            You can filter by region, hospital, or specialty to focus on a
            subset, however any changes you make still apply to the global ranking.
          </p>
          <small className="text-xs text-muted-foreground">
                  *The amount the score is nudged by is fixed, but the number of places it moves depends on 
                  how close the scores are in the surrounding programmes. 
                  </small>


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
