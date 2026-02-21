"use client";

import { motion } from "framer-motion";
import { GripVertical, Swords, Info } from "lucide-react";

interface SpecialtyExplainerProps {
  specialtyCount: number;
}

const PHASES = [
  {
    step: 1,
    icon: GripVertical,
    title: "Drag to rank specialties",
    description:
      "Reorder as many as you like — even a rough order helps. Don't stress about getting it perfect.",
  },
  {
    step: 2,
    icon: Swords,
    title: "Quick-fire matchups",
    description:
      "We'll show you pairs of specialties. Just pick which you prefer — each answer sharpens your ranking.",
  },
] as const;

const PHASE_STAGGER_DELAY = 0.15;

export function SpecialtyExplainer({ specialtyCount }: SpecialtyExplainerProps) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-2 py-4">
      <div className="w-full max-w-sm space-y-6">
        {}
        <div className="relative">
          {}
          <div className="absolute left-5 top-12 bottom-12 w-px bg-border" />

          <div className="space-y-4">
            {PHASES.map((phase, i) => (
              <motion.div
                key={phase.step}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * PHASE_STAGGER_DELAY, duration: 0.4, ease: "easeOut" }}
                className="relative flex gap-4"
              >
                {}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                  <phase.icon className="h-4.5 w-4.5 text-primary" />
                </div>

                {}
                <div className="pt-1.5 space-y-1">
                  <h3 className="text-sm font-semibold text-foreground leading-tight">
                    {phase.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {phase.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="rounded-lg bg-primary/5 border border-primary/15 px-4 py-3"
        >
          <div className="flex gap-2.5">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">
                {specialtyCount} specialties
              </span>{" "}
              to rank. The more you do here, the more accurate your final
              placement ranking will be. You can always fine-tune later.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
