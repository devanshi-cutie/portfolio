"use client";

/*
 * Heading words sharpen into place, adapted from React Bits "BlurText"
 * (reactbits.dev, David Haz, MIT). Word stagger shrinks with length so the
 * whole cascade stays under 300ms. Reduced motion: a plain fade.
 */
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "./easing";

export function BlurWords({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const step = Math.min(0.06, 0.3 / Math.max(words.length, 1));

  if (reduce) {
    return (
      <motion.span
        className={className}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3 }}
      >
        {text}
      </motion.span>
    );
  }

  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: "0.35em", filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: delay + i * step }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
