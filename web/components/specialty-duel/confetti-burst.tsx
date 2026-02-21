"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DEG_HALF_CIRCLE, CONFETTI_SCALE_END, HALF } from "./constants";
import { makeConfettiParticles, type ConfettiParticle } from "./utils";

function ConfettiParticleEl({ p }: { p: ConfettiParticle }) {
  return (
    <motion.div
      key={p.id}
      initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
      animate={{
        opacity: 0,
        x: Math.cos((p.angle * Math.PI) / DEG_HALF_CIRCLE) * p.distance,
        y: Math.sin((p.angle * Math.PI) / DEG_HALF_CIRCLE) * p.distance,
        scale: CONFETTI_SCALE_END,
        rotate: p.rotate,
      }}
      transition={{ duration: 0.9, delay: p.delay, ease: "easeOut" }}
      style={{
        position: "absolute",
        width: p.size,
        height: p.shape === "rect" ? p.size * HALF : p.size,
        backgroundColor: p.color,
        borderRadius: p.shape === "circle" ? "50%" : "2px",
      }}
    />
  );
}

export function ConfettiBurst({ count = 18 }: { count?: number }) {
  const [particles] = useState(() => makeConfettiParticles(count));

  return (
    <div className="absolute top-0 right-0 pointer-events-none overflow-visible z-30">
      {particles.map((p) => (
        <ConfettiParticleEl key={p.id} p={p} />
      ))}
    </div>
  );
}

export function EmojiReaction({ emoji }: { emoji: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.2, y: 10, rotate: -20 }}
      animate={{ opacity: 1, scale: 1.2, y: -12, rotate: 8 }}
      exit={{ opacity: 0, scale: 0.6, y: -40 }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 12,
        mass: 0.5,
      }}
      className="absolute -top-4 -right-1 sm:-top-5 sm:-right-1 z-30 text-3xl sm:text-4xl drop-shadow-lg select-none"
    >
      {emoji}
    </motion.div>
  );
}
