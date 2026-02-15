"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

interface BlogSectionProps {
  id: string;
  children: ReactNode;
  className?: string;
  /** Whether the section takes at least full viewport height (default: true) */
  fullHeight?: boolean;
}

/**
 * Scroll-animated section wrapper for the data blog.
 * Content fades in and slides up when scrolling into view.
 */
export function BlogSection({
  id,
  children,
  className,
  fullHeight = true,
}: BlogSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section
      id={id}
      ref={ref}
      className={cn(
        "relative flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32",
        fullHeight && "min-h-screen",
        className
      )}
    >
      <motion.div
        className="w-full max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </section>
  );
}
