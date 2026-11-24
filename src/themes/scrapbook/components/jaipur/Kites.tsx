/*
 * Two patang kites for the hero sky (Jaipur's Makar Sankranti kite festival).
 * Hand-drawn like the doodles in Doodles.tsx: rose-deep line, soft fills,
 * a bowed cross spar, a tassel tail and a thin string that fades out.
 *
 * Decorative only (aria-hidden, no pointer events). The sway is CSS
 * (.sb-kite in scrapbook.css), so this stays a server component and is
 * static under prefers-reduced-motion.
 *
 * Placement: the root is meant to sit over the hero reel fan's box (same
 * width and 10:11 aspect as HeroStack), so the kites can live in its two top
 * corners, the empty sky above the back phones and beside the front one,
 * outside the hero jharokha's arch (≥9px clear of its outline mid-sway).
 * Sizes are a share of that box: ~35px on a 360px phone, ~57px at 520px.
 */
import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { useSvgId } from "./shapes";

type KiteSpec = {
  /** wrapper position/size classes (percentages of the fan box) */
  className: string;
  /** resting tilt, sway period, phase offset, entrance delay */
  tilt: string;
  sway: string;
  phase: string;
  delay: string;
  body: string;
  cap: string;
  tail: string;
  /** string path in kite units (viewBox 0 0 48 58), from the bridle point outwards */
  line: string;
  lineEnd: [number, number];
};

/** diamond outline, drawn with a little wobble like a pen line */
const BODY = "M24 3.5C31 10 37.4 16 44 22.3 37.6 28.8 31 35.4 24.2 42 17.4 35.5 10.6 29 4 22.2 10.8 15.8 17.4 9.7 24 3.5Z";

const KITES: KiteSpec[] = [
  {
    // top-left corner, a touch above the fan; string trails off to the left
    className: "left-[3%] top-[-1.8%] w-[11%]",
    tilt: "-10deg",
    sway: "8s",
    phase: "-2.5s",
    delay: "450ms",
    body: "var(--blush)",
    cap: "color-mix(in oklab, var(--rose) 70%, var(--blush))",
    tail: "var(--rose)",
    line: "M24 27C16 36 4 42-14 44",
    lineEnd: [-14, 44],
  },
  {
    // top-right corner, smaller and further away; string trails off to the right
    className: "right-[3%] top-[-1.5%] w-[9.5%]",
    tilt: "12deg",
    sway: "9s",
    phase: "-6s",
    delay: "600ms",
    body: "color-mix(in oklab, var(--gold) 34%, var(--cream))",
    cap: "color-mix(in oklab, var(--rose) 55%, var(--cream))",
    tail: "color-mix(in oklab, var(--gold) 70%, var(--rose))",
    line: "M24 27C32 36 46 44 64 46",
    lineEnd: [64, 46],
  },
];

export function Kites({ className }: { className?: string }) {
  const lineId = useSvgId("sb-kite-line");
  return (
    <div aria-hidden className={cn("pointer-events-none", className)}>
      {KITES.map((k, i) => {
        const gradId = `${lineId}-${i}`;
        return (
          <svg
            key={i}
            viewBox="0 0 48 58"
            className={cn("sb-kite absolute h-auto overflow-visible text-(--rose-deep)", k.className)}
            style={{ "--tilt": k.tilt, "--sway": k.sway, "--phase": k.phase, "--d": k.delay } as CSSProperties}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <defs>
              <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={24} y1={27} x2={k.lineEnd[0]} y2={k.lineEnd[1]}>
                <stop offset="0" stopColor="currentColor" stopOpacity={0.75} />
                <stop offset="1" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* string first, so it tucks under the kite */}
            <path d={k.line} stroke={`url(#${gradId})`} strokeWidth={0.9} />
            {/* tail tassel */}
            <path d="M24 41.5 19.8 49.6h8.6Z" style={{ fill: k.tail }} strokeWidth={1.5} />
            <path d="M21.4 50.2 20 55.4M24.1 50.2v5.8M26.8 50.2l1.5 5.1" strokeWidth={1.3} />
            {/* diamond body: fill, the two-tone cap above the bow spar, then the
                slightly wobbly pen outline on top */}
            <path d={BODY} style={{ fill: k.body }} stroke="none" />
            <path d="M24 4C31 10.4 37 16 42.8 21.6 34 14.6 14 14.6 5.2 21.6 11 16 17 10.4 24 4Z" style={{ fill: k.cap }} stroke="none" />
            <path d={BODY} strokeWidth={1.8} />
            {/* spine and bowed cross spar */}
            <path d="M24 4v37.6" strokeWidth={1.3} />
            <path d="M4.8 22C13.6 14.6 34.4 14.6 43.2 22" strokeWidth={1.5} />
          </svg>
        );
      })}
    </div>
  );
}
