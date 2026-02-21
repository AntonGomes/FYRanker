"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords } from "lucide-react";

interface DuelTransitionProps {
  active: boolean;
  totalSpecialties: number;
  lockedCount: number;
  onComplete: () => void;
}

export function DuelTransition({
  active,
  totalSpecialties,
  lockedCount,
  onComplete,
}: DuelTransitionProps) {
  const [phase, setPhase] = useState<"entrance" | "resolve">("entrance");

  useEffect(() => {
    if (!active) {
      setPhase("entrance");
      return;
    }
    // Entrance holds for 800ms, then resolve for 300ms
    const t1 = setTimeout(() => setPhase("resolve"), 800);
    const t2 = setTimeout(() => onComplete(), 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={
              phase === "entrance"
                ? { scale: 1, opacity: 1 }
                : { scale: 1.1, opacity: 0 }
            }
            transition={
              phase === "entrance"
                ? { type: "spring", stiffness: 300, damping: 20 }
                : { duration: 0.3 }
            }
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/30">
                <Swords className="h-10 w-10 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-wider uppercase text-foreground">
                Head to Head
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {totalSpecialties} specialties
                {lockedCount > 0 && `, ${lockedCount} locked`}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
