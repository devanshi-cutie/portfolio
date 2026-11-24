"use client";

/*
 * Rotating keyword, adapted from React Bits "RotatingText" (reactbits.dev,
 * David Haz, MIT): per-character stagger in, quick exit, interruptible.
 * Pauses while hovered or off-screen and settles on the first word after two
 * passes, so it never moves forever. Reduced motion: the first word, static.
 */
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE_IN, EASE_MOVE, EASE_OUT } from "./easing";

const PASSES = 2;

export function RotatingText({
  words,
  interval = 2400,
  className,
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const total = words.length * PASSES;
  const done = step >= total;
  const running = !reduce && !done && !hovered && inView && words.length > 1;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => {
      if (document.visibilityState === "visible") setStep((n) => n + 1);
    }, interval);
    return () => window.clearTimeout(t);
  }, [running, interval, step]);

  const word = reduce ? (words[0] ?? "") : (words[step % words.length] ?? "");
  const chars = Array.from(word);
  const stagger = Math.min(0.03, 0.3 / Math.max(chars.length, 1));

  return (
    <span
      ref={ref}
      className={className}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <span className="sr-only">{words.join(", ")}</span>
      {reduce ? (
        <span aria-hidden>{word}</span>
      ) : (
        <motion.span
          aria-hidden
          layout
          transition={{ layout: { duration: 0.25, ease: EASE_MOVE } }}
          className="relative inline-flex overflow-hidden pb-[0.12em] align-bottom"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={word} className="inline-flex whitespace-pre">
              {chars.map((ch, n) => (
                <motion.span
                  key={n}
                  className="inline-block"
                  initial={{ y: "105%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1, transition: { duration: 0.3, ease: EASE_OUT, delay: n * stagger } }}
                  exit={{ y: "-70%", opacity: 0, transition: { duration: 0.15, ease: EASE_IN, delay: n * stagger * 0.5 } }}
                >
                  {ch}
                </motion.span>
              ))}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      )}
    </span>
  );
}
