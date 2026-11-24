/*
 * Small hand-drawn marks used sparingly as scrapbook annotations (the theme
 * brief asks for star, heart, swash and arrow). Decorative: aria-hidden.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function Star(props: P) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden {...base} strokeWidth={2.2} {...props}>
      <path d="M20 3.5c.9 6.4 2.6 11.6 5 13.3 2.3 1.6 7.4 2.1 11.5 2.7-4.6 1-9.4 1.9-11.2 4.3-1.9 2.6-3.6 8-5.2 12.7-1-5.1-2.6-10.6-4.9-12.4C12.9 22.3 7.8 21.4 3.5 20c4.7-.9 9.6-1.6 11.4-3.7C17 14 18.9 8.6 20 3.5Z" />
    </svg>
  );
}

export function Heart(props: P) {
  return (
    <svg viewBox="0 0 40 36" aria-hidden {...base} strokeWidth={2.2} {...props}>
      <path d="M20.3 32.6C13 27.4 3.6 20.6 4.2 12.3 4.7 6.6 9.4 3.4 13.9 4c3.2.4 5.3 2.7 6.4 5.4 1.3-3 3.9-5.6 7.6-5.6 4.6 0 8.6 3.6 8 9.4-.8 7.6-9.3 13.9-15.6 19.4Z" />
    </svg>
  );
}

export function Swash(props: P) {
  return (
    <svg viewBox="0 0 220 24" aria-hidden {...base} strokeWidth={3} preserveAspectRatio="none" {...props}>
      <path d="M3 17c32-7 70-11 108-11 37 0 72 3 106 8-30-1-62-1-93 1-21 1-42 3-61 6" />
    </svg>
  );
}

export function Arrow(props: P) {
  return (
    <svg viewBox="0 0 80 60" aria-hidden {...base} strokeWidth={2.2} {...props}>
      <path d="M4 8c14 2 30 9 40 20 7 8 11 16 13 25" />
      <path d="M46 46c4 2.6 8 5.4 11 8 2.2-4.2 4.6-8.6 7.6-12.2" />
    </svg>
  );
}

export function Squiggle(props: P) {
  return (
    <svg viewBox="0 0 120 16" aria-hidden {...base} strokeWidth={2.4} {...props}>
      <path d="M2 9c8-7 14-7 20 0s12 7 19 0 13-7 19 0 12 7 19 0 13-7 19 0 12 7 20 0" />
    </svg>
  );
}
