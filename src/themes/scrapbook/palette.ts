/**
 * Pink City palette (from reference/legacy-index.html). The single source of
 * truth for colour: the theme's CSS variables and the admin brand tokens are
 * both derived from this object.
 *
 * Contrast on cream (#F7ECE2): ink 14:1, ink-soft 8.5:1, rose-deep 5.1:1 (AA).
 * Rose (#D98A98) and terracotta are below 4.5:1 there, so they are used for
 * fills, rules and decoration only, never for small text.
 */
export const palette = {
  cream: "#F7ECE2",
  cream2: "#F1E2D4",
  /** lightest paper for cards, polaroids and form fields (derived from cream) */
  card: "#FBF5EF",
  ink: "#2C1119",
  inkSoft: "#5A3A41",
  rose: "#D98A98",
  roseDeep: "#9C4A5C",
  /** hover/pressed primary (rose-deep darkened) */
  roseDeeper: "#7E3647",
  terracotta: "#B6603F",
  blush: "#F0D2C9",
  gold: "#C39A55",
  line: "rgba(44,17,25,0.14)",
} as const;

export type PaletteKey = keyof typeof palette;

/** Theme-internal CSS variables (`bg-(--cream)`, `text-(--rose-deep)`, ...). */
export const themeVars: Record<`--${string}`, string> = {
  "--cream": palette.cream,
  "--cream-2": palette.cream2,
  "--card": palette.card,
  "--ink": palette.ink,
  "--ink-soft": palette.inkSoft,
  "--rose": palette.rose,
  "--rose-deep": palette.roseDeep,
  "--rose-deeper": palette.roseDeeper,
  "--terracotta": palette.terracotta,
  "--blush": palette.blush,
  "--gold": palette.gold,
  "--line": palette.line,
};

/** Jaipur jaali (lattice): diamonds, rosettes and corner ties, drawn in ink. */
const jaaliSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="${palette.ink}" stroke-width="1"><path d="M24 2 46 24 24 46 2 24Z"/><circle cx="24" cy="24" r="7"/><path d="M0 0 8 8M48 0 40 8M0 48 8 40M48 48 40 40"/></g></svg>`;

/** CSS `url()` value for the jaali tile (used as --brand-pattern and by .sb-jaali). */
export const jaaliPattern = `url("data:image/svg+xml,${encodeURIComponent(jaaliSvg)}")`;
