"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useAnimatedCounter } from "@/hooks/use-animated-counter";
import type { OverviewData } from "@/lib/blog-data";

const COUNTER_DURATION_MS = 2000;
const BOUNCE_Y_OFFSET = 10;

interface HeroSectionProps {
  data: OverviewData;
}

function AnimatedStat({
  value,
  label,
  trigger,
  delay,
}: {
  value: number;
  label: string;
  trigger: boolean;
  delay: number;
}) {
  const count = useAnimatedCounter(value, COUNTER_DURATION_MS, trigger);

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={trigger ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
    >
      <span className="text-5xl sm:text-6xl md:text-7xl font-black text-primary tabular-nums">
        {count.toLocaleString()}
      </span>
      <span className="text-base sm:text-lg font-semibold text-foreground mt-1">
        {label}
      </span>
    </motion.div>
  );
}

export function HeroSection({ data }: HeroSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen flex-col items-center justify-center px-4 sm:px-6 lg:px-8"
    >
      <motion.h1
        className="text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[1.1] tracking-tight"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
      >
        Don&apos;t be an
        <br />
        <span className="text-primary">FY Wanker</span>,
        <br />
        use{" "}
        <span className="bg-primary text-primary-foreground px-3 py-1 rounded-lg inline-block">
          FYRanker
        </span>
      </motion.h1>

      <div className="mt-12 sm:mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-12 md:gap-16">
        <AnimatedStat
          value={data.rotations}
          label="rotations"
          trigger={isInView}
          delay={0.3}
        />
        <AnimatedStat
          value={data.sites}
          label="sites"
          trigger={isInView}
          delay={0.5}
        />
        <AnimatedStat
          value={data.specialties}
          label="specialties"
          trigger={isInView}
          delay={0.7}
        />
      </div>

      <motion.p
        className="mt-6 text-lg sm:text-xl text-foreground text-center max-w-xl"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 1.0 }}
      >
        Across 4 Scottish regions. Here&apos;s what the data says.
      </motion.p>

      <motion.div
        className="mt-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, delay: 1.2 }}
      >
        <Link
          href="/wizard"
          className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl px-10 py-5 shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-100"
        >
          Rank your jobs →
        </Link>
      </motion.div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, BOUNCE_Y_OFFSET, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ChevronDown className="w-8 h-8 text-foreground" />
      </motion.div>
    </section>
  );
}
