"use client";

/*
 * Pink City skyline: the top edge of the rose footer. Left to right:
 * Nahargarh Fort on its Aravalli ridge, a few old-city roofs, the Hawa Mahal
 * (the most detailed piece), Patrika Gate, and Jal Mahal standing in the lake
 * with its broken reflection drawn inside the footer below the waterline.
 *
 * One drawing in a 1440 × 150 viewBox (ground = y 150 = the footer's top
 * edge), scaled with `xMidYMax slice`: on wide screens the whole panorama
 * shows; on phones the sides are cropped, leaving the Hawa Mahal and Patrika
 * Gate centred. The reflection SVG is a third of the skyline's height with a
 * 50-unit-tall viewBox, so both share one scale and line up horizontally.
 *
 * Window cut-outs are holes (a mask), so whatever is behind the footer shows
 * through. A few windows warm up gold once when the footer arrives (shown
 * from the start with reduced motion, in print or without JS). Decorative only.
 *
 * The host (the footer) defines `--sky-h` (class `sb-skyline-host`) and uses
 * it for its top margin, so the silhouette never paints over the section above.
 */
import { useInView } from "motion/react";
import { useRef, useSyncExternalStore, type CSSProperties } from "react";
import { cuspedArchPath, fitPath, useSvgId } from "./shapes";
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

const G = 150; // ground / waterline
const r2 = (v: number) => Math.round(v * 100) / 100;

/* ---------------------------------------------------------------- primitives */

const rect = (x: number, y: number, w: number, h: number) => `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;

/** round-topped window opening with its top at y */
const win = (x: number, y: number, w: number, h: number) =>
  `M${r2(x)} ${r2(y + h)}V${r2(y + w / 2)}A${r2(w / 2)} ${r2(w / 2)} 0 0 1 ${r2(x + w)} ${r2(y + w / 2)}V${r2(y + h)}Z`;

/** a chhatri (domed pavilion) standing on `base`: posts, eave, onion dome, finial */
function chhatri(cx: number, base: number, w: number) {
  const eave = base - 3.4;
  const dome = eave - 1.2;
  const tip = dome - 0.9 * w;
  return (
    rect(cx - w / 2 + 0.7, eave, w - 1.4, 3.8) +
    rect(cx - w / 2 - 0.9, dome, w + 1.8, 1.3) +
    `M${r2(cx - w / 2)} ${r2(dome + 0.2)}C${r2(cx - 0.68 * w)} ${r2(dome - 0.42 * w)} ${r2(cx - 0.1 * w)} ${r2(dome - 0.56 * w)} ${r2(cx)} ${r2(tip)}` +
    `C${r2(cx + 0.1 * w)} ${r2(dome - 0.56 * w)} ${r2(cx + 0.68 * w)} ${r2(dome - 0.42 * w)} ${r2(cx + w / 2)} ${r2(dome + 0.2)}Z` +
    rect(cx - 0.45, tip - 0.22 * w - 1, 0.9, 0.22 * w + 1.4)
  );
}

/** a row of openings from x0 to x1 (centred), top at y */
function windowRow(x0: number, x1: number, y: number, w: number, h: number, step: number) {
  const count = Math.floor((x1 - x0 - w) / step) + 1;
  const start = x0 + (x1 - x0 - (w + (count - 1) * step)) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: start + i * step, y, w, h }));
}

type Win = { x: number; y: number; w: number; h: number };
const winPath = (ws: Win[]) => ws.map((o) => win(o.x, o.y, o.w, o.h)).join("");

/* ------------------------------------------------------- Nahargarh on its ridge */

const ridge = (x: number) => {
  const u = x / 400;
  if (u <= 0 || u >= 1) return G;
  return G - 94 * Math.pow(Math.sin(Math.PI * u), 1.25) * (1 + 0.14 * Math.sin(2 * Math.PI * u + 0.9));
};
const topOf = (x0: number, x1: number) => {
  let m = G;
  for (let x = x0; x <= x1; x += 1) m = Math.min(m, ridge(x));
  return m;
};

const HILL = (() => {
  let d = `M0 ${G}`;
  for (let x = 0; x <= 400; x += 5) d += `L${x} ${r2(ridge(x))}`;
  return `${d}L400 ${G}Z`;
})();

/** crenellated fort wall snaking along the ridge */
const WALL = (() => {
  const x0 = 34;
  const x1 = 364;
  const low = (x: number) => ridge(x) - 6;
  let d = `M${x0} ${r2(ridge(x0) + 3)}`;
  for (let x = x0; x < x1; x += 6.5) {
    d += `L${r2(x)} ${r2(low(x) - 3.4)}L${r2(x + 3.2)} ${r2(low(x + 3.2) - 3.4)}L${r2(x + 3.2)} ${r2(low(x + 3.2))}L${r2(x + 6.5)} ${r2(low(x + 6.5))}`;
  }
  for (let x = x1; x >= x0; x -= 6.5) d += `L${r2(x)} ${r2(ridge(x) + 3)}`;
  return `${d}Z`;
})();

/** a bastion tower with merlons and a chhatri, and the palace on the crest */
const FORT = (() => {
  const towers = [
    { x: 250, w: 24, rise: 26 },
    { x: 330, w: 16, rise: 15 },
    { x: 70, w: 14, rise: 12 },
  ];
  let d = "";
  for (const t of towers) {
    const top = topOf(t.x, t.x + t.w) - t.rise;
    d += rect(t.x, top, t.w, ridge(t.x + t.w / 2) - top + 4);
    for (let mx = t.x; mx <= t.x + t.w - 3; mx += (t.w - 3) / Math.max(1, Math.round((t.w - 3) / 5))) d += rect(mx, top - 3, 3, 3.2);
    if (t.w > 20) d += chhatri(t.x + t.w / 2, top - 3, 10);
  }
  // Madhavendra Bhawan on the crest: a long low palace with three chhatris
  const top = topOf(146, 206) - 14;
  d += rect(146, top, 60, ridge(176) - top + 4);
  d += rect(144, top - 1.6, 64, 1.8);
  d += chhatri(156, top - 1.6, 8) + chhatri(176, top - 1.6, 11) + chhatri(196, top - 1.6, 8);
  return d;
})();
const FORT_HOLES = (() => {
  const top = topOf(146, 206) - 14;
  return winPath(windowRow(148, 204, top + 4, 3, 5.5, 7.5));
})();

/* ---------------------------------------------------------------- old city */

/** low flat roofs, a temple shikhara and a couple of small domes between the monuments */
const CITY = [
  rect(382, 128, 20, 22),
  rect(398, 136, 18, 14),
  rect(414, 122, 14, 28) + chhatri(421, 122, 8),
  rect(768, 126, 18, 24),
  rect(784, 134, 22, 16),
  // shikhara (curvilinear temple spire)
  `M802 ${G}V118C802 110 808 102 812 96C816 102 822 110 822 118V${G}Z` + rect(811.5, 90, 1, 6.5),
  rect(820, 124, 24, 26) + chhatri(832, 124, 10),
].join("");
const CITY_HOLES = winPath([
  { x: 386, y: 133, w: 3, h: 5 },
  { x: 393, y: 133, w: 3, h: 5 },
  { x: 772, y: 131, w: 3, h: 5 },
  { x: 779, y: 131, w: 3, h: 5 },
  { x: 826, y: 130, w: 3, h: 5 },
  { x: 836, y: 130, w: 3, h: 5 },
]);

/* --------------------------------------------------------------- Hawa Mahal */

/** stepped pyramidal facade, tallest at the centre (x 600) */
const HM_TIERS = [
  { x0: 432, x1: 768, top: 114 },
  { x0: 448, x1: 752, top: 94 },
  { x0: 500, x1: 700, top: 74 },
  { x0: 534, x1: 666, top: 54 },
  { x0: 564, x1: 636, top: 36 },
];
const mirror = (xs: number[]) => xs.flatMap((x) => [x, 1200 - x]);

const HAWA_MAHAL = (() => {
  let d = "";
  HM_TIERS.forEach((t, i) => {
    const bottom = i === 0 ? G : HM_TIERS[i - 1].top;
    d += rect(t.x0, t.top, t.x1 - t.x0, bottom - t.top + 0.5);
    d += rect(t.x0 - 1.2, t.top - 1.4, t.x1 - t.x0 + 2.4, 1.6); // cornice
  });
  // rows of little domed chhatris along each exposed tier edge (mirrored about x 600)
  const rows: Array<{ xs: number[]; base: number; w: number }> = [
    { xs: [440], base: 112.6, w: 9 },
    { xs: [456, 468, 480, 492], base: 92.6, w: 8 },
    { xs: [508, 520], base: 72.6, w: 8.5 },
    { xs: [542, 555], base: 52.6, w: 9 },
    { xs: [577], base: 34.6, w: 9 },
  ];
  for (const row of rows) for (const x of mirror(row.xs)) d += chhatri(x, row.base, row.w);
  // the crown: a taller central chhatri
  d += chhatri(600, 34.6, 16);
  return d;
})();

const HM_WINDOWS: Win[][] = [
  windowRow(436, 764, 120, 3.6, 7, 9.5),
  windowRow(436, 764, 134, 3.6, 7, 9.5),
  windowRow(452, 748, 99, 3.6, 7, 9.5),
  windowRow(504, 696, 79, 3.6, 7, 9.5),
  windowRow(538, 662, 59, 3.6, 7, 9.5),
  windowRow(568, 632, 41, 3.6, 7, 9.5),
];
const HM_HOLES = winPath(HM_WINDOWS.flat());

/* ------------------------------------------------------------- Patrika Gate */

const GATE = (() => {
  let d = "";
  for (const x of [842, 1026]) {
    d += rect(x, 46, 32, G - 46 + 0.5);
    d += rect(x - 3, 43.6, 38, 2.8);
    d += rect(x - 1.5, 74, 35, 2) + rect(x - 1.5, 112, 35, 2); // string courses
    d += chhatri(x + 16, 43.6, 22);
  }
  d += rect(874, 58, 152, G - 58 + 0.5);
  d += rect(871, 55.4, 158, 2.8);
  for (let x = 876; x <= 1021; x += 7.25) d += `M${r2(x)} 55.6V53.4A1.6 1.6 0 0 1 ${r2(x + 3.2)} 53.4V55.6Z`;
  d += chhatri(950, 53.6, 18) + chhatri(904, 53.6, 10) + chhatri(996, 53.6, 10);
  return d;
})();
const GATE_ARCH = fitPath(cuspedArchPath({ aspect: 70 / 82, lobes: 9 }), 915, 68, 70, 82);
const SIDE_ARCH = cuspedArchPath({ aspect: 17 / 26, lobes: 5, pointed: 0.12 });
const GATE_WINDOWS: Win[] = [
  { x: 852, y: 82, w: 12, h: 20 },
  { x: 1036, y: 82, w: 12, h: 20 },
  { x: 853, y: 120, w: 10, h: 16 },
  { x: 1037, y: 120, w: 10, h: 16 },
];
const GATE_HOLES = GATE_ARCH + fitPath(SIDE_ARCH, 885.5, 96, 17, 26) + fitPath(SIDE_ARCH, 997.5, 96, 17, 26) + winPath(GATE_WINDOWS);

/* ----------------------------------------------------------------- Jal Mahal */

const JAL_HILL = `M1070 ${G}C1140 132 1200 104 1268 100C1340 96 1404 126 1440 ${G}Z`;
const JAL_MAHAL = (() => {
  let d = rect(1160, 118, 220, G - 118 + 0.5);
  d += rect(1157, 116, 226, 2.2);
  for (let x = 1162; x <= 1376; x += 7.6) d += rect(x, 113.4, 3.2, 2.8);
  d += chhatri(1171, 113.6, 20) + chhatri(1369, 113.6, 20);
  d += chhatri(1214, 113.6, 10) + chhatri(1326, 113.6, 10);
  // bangaldar pavilion in the middle
  d += rect(1250, 104, 40, 14);
  d += `M1245 104.6Q1270 90 1295 104.6Z` + rect(1269.5, 90, 1, 5);
  return d;
})();
const JAL_WINDOWS: Win[] = [
  ...windowRow(1164, 1376, 123, 4, 8, 10.5),
  ...windowRow(1253, 1287, 107, 4, 7, 12),
];
const JAL_HOLES = winPath(JAL_WINDOWS) + windowRow(1168, 1372, 140, 6, 10, 14).map((o) => win(o.x, o.y, o.w, o.h)).join("");

/* --------------------------------------------------------------- lit windows */

const LIT: Win[] = [
  HM_WINDOWS[0][9],
  HM_WINDOWS[1][24],
  HM_WINDOWS[2][6],
  HM_WINDOWS[3][13],
  HM_WINDOWS[4][4],
  HM_WINDOWS[5][3],
  GATE_WINDOWS[2],
  JAL_WINDOWS[5],
  JAL_WINDOWS[14],
].filter(Boolean);

/* --------------------------------------------------------------------- kites */

function kite(x: number, y: number, s: number, rot: number) {
  return {
    transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})`,
    body: "M0 -5L3.8 0 0 6.5-3.8 0Z",
    tail: "M0 6.5c-1.2 2.4 1.4 3.6 0 6s1.2 3.4-.4 5.6",
  };
}
const KITES = [kite(404, 24, 1.15, -14), kite(1088, 36, 1, 12)];
const STRINGS = "M404 31C410 70 414 98 420 121M1088 42C1080 78 1074 110 1070 140";

const SILHOUETTE = HILL + WALL + FORT + CITY + HAWA_MAHAL + GATE + JAL_MAHAL;
const HOLES = FORT_HOLES + CITY_HOLES + HM_HOLES + GATE_HOLES + JAL_HOLES;

/** shared box for the skyline layers: full width up to 1500px, centred */
const SKY_BOX = "sb-skyline-svg absolute left-1/2 w-full max-w-[1500px] -translate-x-1/2";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function Skyline() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const holes = useSvgId("sb-sky-holes");
  const ripples = useSvgId("sb-sky-ripples");
  const armed = useArmed();

  return (
    <div
      aria-hidden
      data-armed={armed || undefined}
      data-in={inView || undefined}
      className="sb-skyline pointer-events-none absolute inset-x-0 top-0"
    >
      <svg
        ref={ref}
        focusable="false"
        className={`${SKY_BOX} bottom-[-1px] h-(--sky-h)`}
        viewBox="0 0 1440 150"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <mask id={holes} maskUnits="userSpaceOnUse" x="-20" y="-20" width="1480" height="190">
            <rect x="-20" y="-20" width="1480" height="190" fill="#fff" />
            <path d={HOLES} fill="#000" />
          </mask>
        </defs>
        {/* the hills behind Jal Mahal, lighter: distance */}
        <path d={JAL_HILL} fill="var(--rose)" fillOpacity="0.42" />
        <path d={SILHOUETTE} fill="var(--rose-deep)" mask={`url(#${holes})`} />
        <path d={STRINGS} fill="none" stroke="var(--rose-deep)" strokeOpacity="0.4" strokeWidth="0.6" />
        {KITES.map((k) => (
          <g key={k.transform} transform={k.transform}>
            <path d={k.body} fill="var(--rose-deep)" />
            <path d="M0 -5V6.5M-3.8 0H3.8" fill="none" stroke="var(--blush)" strokeWidth="0.5" />
            <path d={k.tail} fill="none" stroke="var(--rose-deep)" strokeWidth="0.7" strokeLinecap="round" />
          </g>
        ))}
      </svg>

      {/* lit windows on their own layer (same box and scale), so the masked silhouette
          doesn't repaint while they fade */}
      <svg
        focusable="false"
        className={`${SKY_BOX} bottom-[-1px] h-(--sky-h)`}
        viewBox="0 0 1440 150"
        preserveAspectRatio="xMidYMax slice"
      >
        <g fill="var(--gold)">
          {LIT.map((o, i) => (
            <path key={`${o.x}-${o.y}`} className="sb-lit" style={delay(250 + i * 110)} d={win(o.x, o.y, o.w, o.h)} />
          ))}
        </g>
      </svg>

      {/* Jal Mahal's reflection in the lake, inside the footer, broken by ripples */}
      <svg
        focusable="false"
        className={`${SKY_BOX} top-0 h-[calc(var(--sky-h)/3)]`}
        viewBox="0 0 1440 50"
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <mask id={ripples} maskUnits="userSpaceOnUse" x="1040" y="-5" width="420" height="60">
            <rect x="1040" y="-5" width="420" height="60" fill="#fff" />
            <path d={rect(1150, 7, 240, 1.3) + rect(1140, 15.5, 140, 1.6) + rect(1300, 16, 100, 1.4) + rect(1150, 25, 230, 2)} fill="#000" />
          </mask>
        </defs>
        <g mask={`url(#${ripples})`}>
          <g transform="matrix(1 0 0 -0.6 0 90)">
            <path d={JAL_MAHAL} fill="var(--rose)" fillOpacity="0.36" />
            <path d={JAL_HOLES} fill="var(--rose-deep)" />
          </g>
        </g>
        <path
          d="M1090 4h50M1400 6h34M1110 12h30M1395 14h40M1120 21h22M1388 24h30M1180 33h60M1300 31h44"
          fill="none"
          stroke="var(--rose)"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
