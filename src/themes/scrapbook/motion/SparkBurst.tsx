"use client";

/*
 * A one-shot burst of ink sparks, adapted from React Bits "ClickSpark"
 * (reactbits.dev, David Haz, MIT) and rendered with motion instead of canvas.
 * Used once: the contact-form success moment. Hidden under reduced motion.
 */
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "./easing";

export function SparkBurst({ count = 12, radius = 90, color = "var(--rose-deep)" }: { count?: number; radius?: number; color?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 block size-0">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const r = radius * (i % 2 ? 0.75 : 1);
        return (
          <motion.span
            key={i}
            className="absolute left-0 top-0 block h-[3px] w-4 origin-left rounded-full"
            style={{ background: color, rotate: `${(angle * 180) / Math.PI}deg` }}
            initial={{ x: 0, y: 0, opacity: 1, scaleX: 1 }}
            animate={{ x: Math.cos(angle) * r, y: Math.sin(angle) * r, opacity: 0, scaleX: 0.2 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.12 }}
          />
        );
      })}
    </span>
  );
}
