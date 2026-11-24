"use client";

/*
 * Scroll reveal: content rises 20px and fades in once, ease-out. Used to give
 * sections a reading order as they arrive. Reduced motion: fade only.
 */
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "./easing";

export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
  as = "div",
  amount = 0.25,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "article" | "figure";
  /** share that must be visible; carousel slides use 0 so the peeking card shows */
  amount?: number;
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount, margin: "0px 0px -8% 0px" }}
      transition={{ duration: reduce ? 0.25 : 0.4, delay, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}
