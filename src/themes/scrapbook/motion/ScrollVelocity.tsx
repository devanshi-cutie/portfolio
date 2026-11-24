"use client";

/*
 * Brand marquee that drifts at a steady speed and surges with scroll velocity.
 * Adapted from React Bits "ScrollVelocity" (reactbits.dev, David Haz, MIT).
 * Linear drift is the one sanctioned linear motion (marquee). It stops while
 * hovered or focused, has a keyboard pause toggle, and stands still under
 * reduced motion.
 */
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
} from "motion/react";
import { useRef, useState, type ReactNode } from "react";

export function ScrollVelocity({
  children,
  baseVelocity = -2.2,
  copies = 3,
  className,
  label = "moving strip",
}: {
  children: ReactNode;
  /** percent of one copy's width per second; negative drifts left */
  baseVelocity?: number;
  copies?: number;
  className?: string;
  /** names the pause button: "Pause {label}" */
  label?: string;
}) {
  const reduce = useReducedMotion();
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smooth = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false });
  const direction = useRef(1);
  const hovering = useRef(false);
  const [paused, setPaused] = useState(false);

  // one copy = 100 / copies percent of the track
  const x = useTransform(baseX, (v) => `${wrap(-100 / copies, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    if (reduce || paused || hovering.current) return;
    const dt = Math.min(delta, 64) / 1000;
    let move = direction.current * baseVelocity * dt;
    const f = factor.get();
    if (f < 0) direction.current = -1;
    else if (f > 0) direction.current = 1;
    move += direction.current * move * Math.abs(f);
    baseX.set(baseX.get() + move / copies);
  });

  return (
    <div
      className={className}
      onPointerEnter={() => (hovering.current = true)}
      onPointerLeave={() => (hovering.current = false)}
      onFocus={() => (hovering.current = true)}
      onBlur={() => (hovering.current = false)}
    >
      {reduce ? null : (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="sr-only z-10 rounded-full bg-(--cream) px-4 py-2 text-sm font-semibold text-(--ink) focus:not-sr-only focus:absolute focus:left-4 focus:top-1/2 focus:-translate-y-1/2"
        >
          {paused ? `Play ${label}` : `Pause ${label}`}
        </button>
      )}
      <div aria-hidden className="overflow-hidden">
        <motion.div className="flex w-max whitespace-nowrap will-change-transform" style={{ x }}>
          {Array.from({ length: copies }, (_, i) => (
            <div key={i} className="flex shrink-0 items-center">
              {children}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
