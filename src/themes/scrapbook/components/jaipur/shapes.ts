/**
 * Shared Jaipur shapes, generated once at module load (pure, deterministic).
 *
 * The cusped (multifoil) arch is the window shape of the Hawa Mahal jharokhas
 * and of the Patrika Gate arches: a slightly pointed arch whose edge is a run
 * of small round lobes, with sharp points (cusps) between them facing into
 * the opening.
 *
 * Paths are in a 0..1 box so they work as `clipPathUnits="objectBoundingBox"`
 * clip paths on any element size, or inside a `viewBox="0 0 1 1"` SVG with
 * `preserveAspectRatio="none"` (add `vector-effect="non-scaling-stroke"` to
 * strokes). `aspect` is the target width/height so the lobes stay round there.
 */

import { useId } from "react";

export interface CuspedArchOptions {
  /** width / height of the box the shape will be drawn in (4:5 portrait → 0.8) */
  aspect: number;
  /** number of lobes along the arch (odd keeps a lobe at the crown) */
  lobes?: number;
  /** how far the arch centres sit from the middle: 0 = round, 0.2 = clearly pointed */
  pointed?: number;
  /** lobe radius as a multiple of half the cusp-to-cusp chord (>1 = shallower lobes) */
  lobeRadius?: number;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Closed outline of a cusped-arch opening: straight jambs from the bottom
 * corners up to the springing line, then the lobed, two-centred arch.
 */
export function cuspedArchPath({ aspect, lobes = 9, pointed = 0.14, lobeRadius = 1.08 }: CuspedArchOptions): string {
  // build in width units (the box is 1 wide and 1/aspect tall), normalise at the end
  const H = 1 / aspect;
  const xc = 0.5 + pointed; // left arc centre (mirrored for the right arc)
  const R = xc; // passes through the left jamb (0, spring)
  const crown = Math.sqrt(R * R - (0.5 - xc) * (0.5 - xc));
  const spring = crown + 0.06; // leave room for the crown lobe

  // arc-length-even points along the two-centred arch, left jamb → crown → right jamb
  const thetaA = Math.acos((0.5 - xc) / R); // angle at the crown on the left arc
  const half = Math.PI - thetaA;
  const at = (s: number): [number, number] => {
    // s in [0, 1]: 0 = left jamb, 0.5 = crown, 1 = right jamb
    if (s <= 0.5) {
      const th = Math.PI - half * (s / 0.5);
      return [xc + R * Math.cos(th), spring - R * Math.sin(th)];
    }
    const [x, y] = at(1 - s);
    return [1 - x, y];
  };
  const cusps = Array.from({ length: lobes + 1 }, (_, i) => at(i / lobes));

  const segs: Array<[string, ...number[]]> = [["M", 0, H], ["L", 0, spring]];
  for (let i = 0; i < lobes; i++) {
    const [x0, y0] = cusps[i];
    const [x1, y1] = cusps[i + 1];
    const rl = (Math.hypot(x1 - x0, y1 - y0) / 2) * lobeRadius;
    // sweep 1 = clockwise on screen, which bulges outward (away from the opening)
    segs.push(["A", rl, rl, 0, 0, 1, x1, y1]);
  }
  segs.push(["L", 1, H], ["Z"]);

  // normalise to 0..1 on both axes; lobes poke a little outside the base arch
  let minX = 0, maxX = 1, minY = Infinity;
  for (let i = 0; i < lobes; i++) {
    const [x0, y0] = cusps[i];
    const [x1, y1] = cusps[i + 1];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const chord = Math.hypot(x1 - x0, y1 - y0) / 2;
    const rl = chord * lobeRadius;
    const sag = rl - Math.sqrt(Math.max(rl * rl - chord * chord, 0));
    // outward normal of the chord (left-hand normal for a left→right walk on screen)
    const nx = (y1 - y0) / (2 * chord);
    const ny = -(x1 - x0) / (2 * chord);
    minX = Math.min(minX, mx + nx * sag);
    maxX = Math.max(maxX, mx + nx * sag);
    minY = Math.min(minY, my + ny * sag);
  }
  const sx = 1 / (maxX - minX);
  const sy = 1 / (H - minY);
  const X = (v: number) => round((v - minX) * sx);
  const Y = (v: number) => round((v - minY) * sy);

  return segs
    .map(([cmd, ...n]) => {
      if (cmd === "Z") return "Z";
      if (cmd === "A") {
        const [rx, ry, rot, large, sweep, x, y] = n;
        return `A${round(rx * sx)} ${round(ry * sy)} ${rot} ${large} ${sweep} ${X(x)} ${Y(y)}`;
      }
      return `${cmd}${X(n[0])} ${Y(n[1])}`;
    })
    .join(" ");
}

/** 4:5 portrait opening (About portrait). */
export const ARCH_PORTRAIT = cuspedArchPath({ aspect: 0.8 });
/** Taller 2:3 opening (hero backdrop window, gate arches). */
export const ARCH_TALL = cuspedArchPath({ aspect: 2 / 3, lobes: 11 });

/**
 * Re-maps a 0..1 path (M/L/H/V/A/C/Q/Z, absolute commands only, as the shapes
 * module emits) into a box at (x, y) of size w × h. Baking the transform into
 * the path keeps stroke widths and `pathLength` dash maths untouched.
 */
export function fitPath(d: string, x: number, y: number, w: number, h: number): string {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return d
    .replace(/([MLHVACQZ])([^MLHVACQZ]*)/g, (_, cmd: string, args: string) => {
      const n = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
      switch (cmd) {
        case "A": {
          const out: number[] = [];
          for (let i = 0; i + 6 < n.length; i += 7) {
            out.push(r(n[i] * w), r(n[i + 1] * h), n[i + 2], n[i + 3], n[i + 4], r(x + n[i + 5] * w), r(y + n[i + 6] * h));
          }
          return `A${out.join(" ")} `;
        }
        case "H":
          return `H${n.map((v) => r(x + v * w)).join(" ")} `;
        case "V":
          return `V${n.map((v) => r(y + v * h)).join(" ")} `;
        case "Z":
          return "Z ";
        default:
          return `${cmd}${n.map((v, i) => (i % 2 === 0 ? r(x + v * w) : r(y + v * h))).join(" ")} `;
      }
    })
    .trim();
}

/**
 * An id usable inside `url(#…)`: React ids carry characters CSS would need
 * escaped. A plain hook (no client directive), so server components can use it.
 */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
}
