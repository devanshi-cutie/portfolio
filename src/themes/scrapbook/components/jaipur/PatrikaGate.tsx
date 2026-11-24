"use client";

/*
 * Patrika Gate corridor: five painted cusped arches receding toward a
 * vanishing point, as if looking down the gate's arcade. Outlines alternate
 * rose-deep / terracotta / gold with a thin companion rule, the bands between
 * pairs carry painted dots or dashes and a very faint wash (≤ 10%), and the
 * far opening glows faintly gold. A small domed kalash crowns the outer arch.
 *
 * Every arch is the shared ARCH_TALL (2:3) shape scaled about the vanishing
 * point, so the arches nest in perspective. When the gate scrolls into view
 * the arches grow out of the vanishing point, nearest last (jaipur.css);
 * reduced motion shows them in place. Decorative only.
 */
import { useInView } from "motion/react";
import { useRef, useSyncExternalStore, type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { ARCH_TALL, fitPath } from "./shapes";
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

const W = 300;
const H = 450;
/** vanishing point; keep in step with `.sb-gate-a { transform-origin }` (50% 52%) */
const VP = { x: W * 0.5, y: H * 0.52 };
/** the outer arch's box; everything else is this scaled about VP */
const OUTER = { x: 10, y: 30, w: 280, h: 420 };

const archAt = (f: number) =>
  fitPath(ARCH_TALL, VP.x + (OUTER.x - VP.x) * f, VP.y + (OUTER.y - VP.y) * f, OUTER.w * f, OUTER.h * f);

/** the same arch left open at the floor (outlines only: no line across the bottom) */
const openArchAt = (f: number) => archAt(f).replace(/\s*Z\s*$/, "");

const SCALES = [1, 0.79, 0.62, 0.48, 0.37];
const COLORS = ["var(--rose-deep)", "var(--terracotta)", "var(--gold)", "var(--rose-deep)", "var(--terracotta)"];
const WASHES = ["var(--rose)", "var(--terracotta)", "var(--gold)", "var(--rose)", "var(--gold)"];

const ARCHES = SCALES.map((f, i) => {
  const next = SCALES[i + 1];
  const inner = f * 0.955;
  return {
    f,
    color: COLORS[i],
    wash: WASHES[i],
    edge: openArchAt(f),
    rule: openArchAt(inner),
    /** the band between this arch and the next one in */
    band: next ? `${archAt(f)} ${archAt(next)}` : null,
    /** painted pattern along the middle of that band */
    pattern: next ? openArchAt((inner + next) / 2) : null,
    dots: i % 2 === 0,
  };
});
const FAR = archAt(SCALES[SCALES.length - 1] * 0.955);

const sw = (k: number) => ({ strokeWidth: `calc(var(--g-sw) * ${k})` }) as CSSProperties;

export function PatrikaGate({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const armed = useArmed();

  return (
    <div
      ref={ref}
      aria-hidden
      data-armed={armed || undefined}
      data-in={inView || undefined}
      className={cn("sb-gate pointer-events-none", className)}
    >
      <svg focusable="false" className="sb-gate-svg block h-auto w-full" viewBox={`0 0 ${W} ${H}`}>
        {/* the far opening: a faint glow at the end of the corridor */}
        <g className="sb-gate-a" style={{ "--d": "0ms" } as CSSProperties}>
          <path d={FAR} fill="var(--gold)" fillOpacity="0.1" />
        </g>
        {ARCHES.map((a, i) => (
          <g
            key={a.f}
            className="sb-gate-a"
            style={{ "--d": `${(ARCHES.length - 1 - i) * 40}ms` } as CSSProperties}
            fill="none"
            stroke={a.color}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {a.band ? <path d={a.band} fillRule="evenodd" fill={a.wash} fillOpacity="0.08" stroke="none" /> : null}
            <path d={a.edge} style={sw(Math.max(a.f, 0.6))} />
            <path d={a.rule} style={sw(Math.max(a.f, 0.6) * 0.5)} />
            {a.pattern ? (
              <path
                d={a.pattern}
                style={sw(a.dots ? Math.max(a.f, 0.6) * 1.3 : Math.max(a.f, 0.6) * 0.55)}
                strokeDasharray={a.dots ? `0 ${(7 * a.f).toFixed(2)}` : `${(5 * a.f).toFixed(2)} ${(4 * a.f).toFixed(2)}`}
                strokeOpacity="0.8"
              />
            ) : null}
            {i === 0 ? (
              /* a small domed kalash on the crown of the outer arch */
              <>
                <path
                  d="M139 31 C135.5 26 141 20.5 150 15.5 C159 20.5 164.5 26 161 31 Z"
                  fill="var(--gold)"
                  fillOpacity="0.16"
                  style={sw(0.8)}
                />
                <path d="M136 31.5 H164" style={sw(0.8)} />
                <path d="M150 15.5 V11 M150 7.5 V3.5" style={sw(0.7)} />
                <circle cx="150" cy="9.25" r="1.75" fill="var(--gold)" fillOpacity="0.5" style={sw(0.6)} />
              </>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
