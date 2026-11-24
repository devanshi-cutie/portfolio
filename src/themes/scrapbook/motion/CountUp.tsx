"use client";

/*
 * Count-up for stat values like "40+", "2.6K", "8+". Adapted from React Bits
 * "CountUp" (reactbits.dev, David Haz, MIT). The server renders the final
 * value; the client rewinds to zero only while the number is off-screen, then
 * springs up when it scrolls in. Values that are not numbers ("3-in-1") are
 * left alone. Text updates go through a ref, not React state.
 */
import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

const NUM = /^(\D*?)(\d+(?:\.\d+)?)(.*)$/;

export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const match = useMemo(() => NUM.exec(value), [value]);
  const armed = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !match || reduce || armed.current) return;
    const rect = el.getBoundingClientRect();
    const visible = rect.top < window.innerHeight && rect.bottom > 0;
    if (visible) return; // already on screen: never flash a zero
    armed.current = true;
    el.textContent = `${match[1]}0${match[3]}`;
  }, [match, reduce]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !match || !inView || !armed.current) return;
    const [, prefix, num, suffix] = match;
    const target = Number(num);
    const decimals = num.includes(".") ? num.split(".")[1].length : 0;
    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, match]);

  return (
    <span className={className}>
      <span className="sr-only">{value}</span>
      <span ref={ref} aria-hidden>
        {value}
      </span>
    </span>
  );
}
