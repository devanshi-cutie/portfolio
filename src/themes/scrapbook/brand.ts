import type { ThemeBrand } from "../types";
import { fontStacks, fontVariables } from "./fonts";
import { jaaliPattern, palette } from "./palette";

/** Brand tokens for the admin panel, derived from the same palette as the site. */
export const brand: ThemeBrand = {
  fontClassName: fontVariables,
  cssVars: {
    "--brand-bg": palette.cream,
    "--brand-surface": palette.cream2,
    "--brand-surface-2": palette.card,
    "--brand-ink": palette.ink,
    "--brand-ink-soft": palette.inkSoft,
    "--brand-primary": palette.roseDeep,
    "--brand-primary-ink": palette.cream,
    "--brand-accent": palette.terracotta,
    "--brand-highlight": palette.rose,
    "--brand-blush": palette.blush,
    "--brand-gold": palette.gold,
    "--brand-line": palette.line,
    "--brand-font-display": fontStacks.display,
    "--brand-font-body": fontStacks.body,
    // optional decoration tokens (the admin login uses them with neutral fallbacks)
    "--brand-pattern": jaaliPattern,
    "--brand-shadow": "0 30px 60px -30px rgba(44,17,25,0.35)",
    "--brand-radius-hero": "192px 192px 28px 28px",
  },
};
