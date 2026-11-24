"use client";

/*
 * Hawa Mahal jharokha standing behind the About portrait. The photo, cut to
 * the cusped arch, sits centred inside a larger line-drawn window: its own
 * double cusped-arch moulding with a lattice screen showing round the photo,
 * jaali spandrels, slim pillars with bell capitals, a chhajja eave with a
 * chhatri and kalash on the crown, and a curved bangaldar balcony ledge on
 * three corbels underneath.
 *
 * Geometry is in "photo units": the photo is 100 wide and 125 tall (4:5) at
 * the origin; the window spans x -22..122 and y -51..157. The root takes the
 * window's aspect ratio and places the photo by percentage, so the whole
 * drawing is part of the layout (nothing overhangs) and the photo is
 * 100/144 ≈ 69% of the root width.
 *
 * The window sits behind the photo. Its lines draw themselves once it scrolls
 * into view and the photo fades up (jaipur.css); reduced motion, print and
 * no-JS show it all.
 */
import { useInView } from "motion/react";
import { useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ARCH_PORTRAIT, cuspedArchPath, fitPath, useSvgId } from "./shapes";
import "./jaipur.css";

/* hydrated? false on the server and during hydration, true after: pieces hide only once armed,
   so no-JS / a hydration error shows the finished drawing (client-only hook, so it lives here) */
const noSubscribe = () => () => {};
const useArmed = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

const STROKE = "var(--rose-deep)";

/* ---- window box (photo units) ---- */
const VB = { x: -22, y: -51, w: 144, h: 208 };
const pct = (v: number) => `${(v * 100).toFixed(4)}%`;
const PHOTO_BOX: CSSProperties = {
  left: pct(-VB.x / VB.w),
  top: pct(-VB.y / VB.h),
  width: pct(100 / VB.w),
  height: pct(125 / VB.h),
};

/* ---- geometry ---- */
/** the window opening (inner rule) and its moulding (outer rule), both cusped */
const INNER = fitPath(ARCH_PORTRAIT, -8, -12, 116, 145);
const OUTER = fitPath(ARCH_PORTRAIT, -10.4, -15, 120.8, 148);
/** a thin rule just outside the photo's own arch */
const PHOTO_RULE = fitPath(ARCH_PORTRAIT, -1.3, -1.6, 102.6, 126.6);
const FRAME = "M-12.5 -18 H112.5 V133 H-12.5 Z";
const CROWN_ARCH = fitPath(cuspedArchPath({ aspect: 1.4, lobes: 5, pointed: 0.1 }), 45, -35.4, 10, 7.1);
const CHHAJJA = "M-18 -25 H118 L121.5 -21 H-21.5 Z";
const DOME = "M43 -38 C39.4 -40.4 42 -45 50 -47 C58 -45 60.6 -40.4 57 -38 Z";
const CROWN_EAVE = "M39 -36 H61 L62.8 -37.6 H37.2 Z";
const LEDGE = "M-20 133 H120 C121 133 121 135.6 119.6 136.2 Q50 141.6 -19.6 136.2 C-21 135.6 -21 133 -20 133 Z";

const PILLARS = [-17, 117];

/** the fringe of small scallops under the chhajja */
const FRINGE = Array.from({ length: 56 }, (_, i) => `M${(-20 + i * 2.5).toFixed(2)} -20.6 a1.1 1.1 0 0 0 2.2 0`).join(" ");
/** tiny lotus merlons along the parapet */
const MERLONS = Array.from({ length: 32 }, (_, i) => `M${-13 + i * 4} -27.2 a1 1 0 0 1 2 0`).join(" ");

/* balcony: the lower moulding is a quadratic from (-17, 137.8) via (50, 143.8) to (117, 137.8) */
const bandAt = (x: number) => {
  const t = (x + 17) / 134;
  return 137.8 + 2 * t * (1 - t) * 6;
};
const BEADS = Array.from({ length: 13 }, (_, i) => {
  const x = -10 + i * 10;
  return { x, y: bandAt(x) + 1.25 };
});

function corbel(x: number, len: number, half: number) {
  const y = bandAt(x);
  const p = (f: number) => (y + len * f).toFixed(2);
  const outline =
    `M${x - half} ${y} C${x - half} ${p(0.25)} ${x - half * 0.62} ${p(0.3)} ${x - half * 0.62} ${p(0.45)} ` +
    `L${x - half * 0.4} ${p(0.6)} C${x - half * 0.4} ${p(0.78)} ${x - half * 0.2} ${p(0.86)} ${x} ${p(1)} ` +
    `C${x + half * 0.2} ${p(0.86)} ${x + half * 0.4} ${p(0.78)} ${x + half * 0.4} ${p(0.6)} ` +
    `L${x + half * 0.62} ${p(0.45)} C${x + half * 0.62} ${p(0.3)} ${x + half} ${p(0.25)} ${x + half} ${y}`;
  const step = `M${x - half * 0.62} ${p(0.45)} H${x + half * 0.62}`;
  return { outline, step };
}
const CORBELS = [corbel(10, 10, 3.6), corbel(50, 14, 4.6), corbel(90, 10, 3.6)];

function pillar(cx: number) {
  return {
    silhouette:
      `M${cx - 3} 133 V129.5 H${cx - 2.4} V127.6 H${cx - 1.5} V-14 ` +
      `C${cx - 1.5} -16.2 ${cx - 3.1} -16.8 ${cx - 3.1} -18.6 H${cx - 3.5} V-20.8 H${cx + 3.5} V-18.6 H${cx + 3.1} ` +
      `C${cx + 3.1} -16.8 ${cx + 1.5} -16.2 ${cx + 1.5} -14 V127.6 H${cx + 2.4} V129.5 H${cx + 3} V133 Z`,
    base: `M${cx - 3} 133 V129.5 H${cx + 3} V133 M${cx - 2.4} 129.5 V127.6 H${cx + 2.4} V129.5`,
    shaft: `M${cx - 1.5} 127.6 V-14 M${cx + 1.5} 127.6 V-14`,
    rings: `M${cx - 2} 36 H${cx + 2} M${cx - 2} 37.3 H${cx + 2} M${cx - 2} 84 H${cx + 2} M${cx - 2} 85.3 H${cx + 2}`,
    capital:
      `M${cx - 1.5} -14 C${cx - 1.5} -16.2 ${cx - 3.1} -16.8 ${cx - 3.1} -18.6 H${cx + 3.1} ` +
      `C${cx + 3.1} -16.8 ${cx + 1.5} -16.2 ${cx + 1.5} -14 M${cx - 3.5} -18.6 V-20.8 H${cx + 3.5} V-18.6 Z`,
    pinnacle: `M${cx} -25 V-26.4 M${cx - 0.7} -27.1 a0.7 0.7 0 1 0 1.4 0 a0.7 0.7 0 1 0 -1.4 0 M${cx} -27.8 V-28.6`,
  };
}

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function Jharokha({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const armed = useArmed();
  const clip = useSvgId("sb-jh-clip");
  const jaali = useSvgId("sb-jh-jaali");
  const screen = useSvgId("sb-jh-screen");

  return (
    <div
      ref={ref}
      data-armed={armed || undefined}
      data-in={inView || undefined}
      className={cn("sb-jh relative w-full", className)}
      style={{ aspectRatio: `${VB.w} / ${VB.h}` }}
    >
      {/* the window, behind the photo */}
      <svg
        aria-hidden
        focusable="false"
        className="sb-jh-svg absolute inset-0 size-full"
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      >
        <defs>
          <clipPath id={clip} clipPathUnits="objectBoundingBox">
            <path d={ARCH_PORTRAIT} />
          </clipPath>
          {/* spandrel jaali: diamonds, rosettes and corner ties (the theme's lattice tile) */}
          <pattern id={jaali} width="5" height="5" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={STROKE} strokeWidth="0.2" opacity="0.6">
              <path d="M2.5 0.35 4.65 2.5 2.5 4.65 0.35 2.5Z" />
              <circle cx="2.5" cy="2.5" r="0.85" />
              <path d="M0 0 .7.7M5 0 4.3.7M0 5 .7 4.3M5 5 4.3 4.3" />
            </g>
          </pattern>
          {/* the screen seen through the window round the photo: a finer, fainter lattice */}
          <pattern id={screen} width="3.2" height="3.2" patternUnits="userSpaceOnUse">
            <path d="M1.6 0 3.2 1.6 1.6 3.2 0 1.6Z" fill="none" stroke={STROKE} strokeWidth="0.16" opacity="0.4" />
          </pattern>
        </defs>

        {/* soft washes, faded in after the lines start */}
        <g className="sb-jh-fill">
          <path d={`${FRAME} ${OUTER}`} fillRule="evenodd" fill="var(--rose)" fillOpacity="0.2" />
          <path d={`${FRAME} ${OUTER}`} fillRule="evenodd" fill={`url(#${jaali})`} />
          <path d={`${OUTER} ${INNER}`} fillRule="evenodd" fill="var(--terracotta)" fillOpacity="0.16" />
          <path d={INNER} fill="var(--blush)" fillOpacity="0.75" />
          <path d={INNER} fill={`url(#${screen})`} />
          {PILLARS.map((cx) => (
            <path key={cx} d={pillar(cx).silhouette} fill="var(--blush)" fillOpacity="0.9" />
          ))}
          <path d={CHHAJJA} fill="var(--rose)" fillOpacity="0.4" />
          <path d="M-15 -25 V-27.2 H115 V-25 Z" fill="var(--terracotta)" fillOpacity="0.16" />
          <path d={DOME} fill="var(--gold)" fillOpacity="0.5" />
          <path d={CROWN_EAVE} fill="var(--rose)" fillOpacity="0.45" />
          <path d={LEDGE} fill="var(--terracotta)" fillOpacity="0.2" />
          <path d="M-19.6 136.2 Q50 141.6 119.6 136.2 L117 137.8 Q50 143.8 -17 137.8 Z" fill="var(--blush)" fillOpacity="0.95" />
          {CORBELS.map((c, i) => (
            <path key={i} d={`${c.outline} Z`} fill="var(--blush)" fillOpacity="0.95" />
          ))}
          {BEADS.map((b) => (
            <circle key={b.x} cx={b.x} cy={b.y} r="0.55" fill={STROKE} fillOpacity="0.55" />
          ))}
          <circle cx="50" cy="-48" r="0.95" fill="var(--gold)" />
        </g>

        {/* the line drawing */}
        <g fill="none" stroke={STROKE} strokeLinecap="round" strokeLinejoin="round">
          {/* double moulding following the cusped arch, and the rule round the photo */}
          <g style={d(0)}>
            <path className="sb-ln sb-jh-w" pathLength={1} d={OUTER} />
            <path className="sb-ln sb-jh-t" pathLength={1} d={INNER} />
            <path className="sb-ln sb-jh-t" pathLength={1} d={PHOTO_RULE} />
          </g>
          {/* rectangular frame, double rule */}
          <g style={d(80)}>
            <path className="sb-ln sb-jh-w" pathLength={1} d="M-14 133 V-19.5 H114 V133" />
            <path className="sb-ln sb-jh-t" pathLength={1} d="M-12.5 133 V-18 H112.5 V133" />
          </g>
          {/* slim pillars with bell capitals */}
          <g style={d(160)}>
            {PILLARS.map((cx) => {
              const p = pillar(cx);
              return (
                <g key={cx}>
                  <path className="sb-ln sb-jh-w" pathLength={1} d={p.shaft} />
                  <path className="sb-ln sb-jh-t" pathLength={1} d={p.base} />
                  <path className="sb-ln sb-jh-t" pathLength={1} d={p.rings} />
                  <path className="sb-ln sb-jh-w" pathLength={1} d={p.capital} />
                </g>
              );
            })}
          </g>
          {/* chhajja (sloped eave) with its fringe, parapet and corner pinnacles */}
          <g style={d(240)}>
            <path className="sb-ln sb-jh-w" pathLength={1} d={CHHAJJA} />
            <path className="sb-ln sb-jh-t" pathLength={1} d={FRINGE} />
            <path className="sb-ln sb-jh-t" pathLength={1} d="M-15 -25 V-27.2 H115 V-25" />
            <path className="sb-ln sb-jh-t" pathLength={1} d={MERLONS} />
            {PILLARS.map((cx) => (
              <path key={cx} className="sb-ln sb-jh-t" pathLength={1} d={pillar(cx).pinnacle} />
            ))}
          </g>
          {/* crown chhatri: platform, posts, cusped opening, eave, onion dome, kalash */}
          <g style={d(320)}>
            <path className="sb-ln sb-jh-t" pathLength={1} d="M38 -27.2 V-29 H62 V-27.2" />
            <path className="sb-ln sb-jh-t" pathLength={1} d="M40.6 -29 V-36 M59.4 -29 V-36 M42.6 -29 V-36 M57.4 -29 V-36" />
            <path className="sb-ln sb-jh-t" pathLength={1} d={CROWN_ARCH} />
            <path className="sb-ln sb-jh-t" pathLength={1} d={CROWN_EAVE} />
            <path className="sb-ln sb-jh-w" pathLength={1} d={DOME} />
            <path className="sb-ln sb-jh-t" pathLength={1} d="M50 -49 V-50.4" />
          </g>
          {/* bangaldar balcony ledge and its lower moulding */}
          <g style={d(200)}>
            <path className="sb-ln sb-jh-w" pathLength={1} d={LEDGE} />
            <path className="sb-ln sb-jh-t" pathLength={1} d="M-17 137.8 Q50 143.8 117 137.8" />
          </g>
          {/* corbel brackets */}
          <g style={d(300)}>
            {CORBELS.map((c, i) => (
              <g key={i}>
                <path className="sb-ln sb-jh-w" pathLength={1} d={c.outline} />
                <path className="sb-ln sb-jh-t" pathLength={1} d={c.step} />
              </g>
            ))}
          </g>
        </g>
      </svg>

      {/* the portrait, centred in the window and cut to the cusped arch */}
      {/* the clip stays on this static box; only the inner layer animates (Safari repaints
          url() clip-paths badly on transformed elements) */}
      <div className="absolute" style={{ ...PHOTO_BOX, clipPath: `url(#${clip})` }}>
        <div className="sb-jh-photo size-full bg-(--cream-2)">{children}</div>
      </div>
    </div>
  );
}
