"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BlogSection } from "./blog-section";

export function CTASection() {
  return (
    <BlogSection
      id="cta"
      className="bg-foreground text-background"
    >
      <div className="text-center">
        <motion.h2
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Ready to rank yours?
        </motion.h2>
        <motion.p
          className="mt-4 text-lg sm:text-xl max-w-xl mx-auto"
          style={{ color: "inherit" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Tell us what matters and get a personalised ranking in seconds.
        </motion.p>
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Link
            href="/wizard"
            className="inline-flex items-center justify-center rounded-xl bg-background text-foreground font-bold text-xl px-10 py-5 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-100"
          >
            Start ranking →
          </Link>
        </motion.div>
      </div>
    </BlogSection>
  );
}
