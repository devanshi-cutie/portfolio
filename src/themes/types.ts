import type { ComponentType, ReactNode } from "react";
import type { Collection, MediaItem, SiteContent } from "@/core/types/content";

/** The exact brand token keys every theme exports (the admin panel styles itself with them). */
export type BrandTokenKey =
  | "--brand-bg"
  | "--brand-surface"
  | "--brand-surface-2"
  | "--brand-ink"
  | "--brand-ink-soft"
  | "--brand-primary"
  | "--brand-primary-ink"
  | "--brand-accent"
  | "--brand-highlight"
  | "--brand-blush"
  | "--brand-gold"
  | "--brand-line"
  | "--brand-font-display"
  | "--brand-font-body";

/** Optional decoration tokens; consumers must fall back when a theme omits them. */
export type OptionalBrandTokenKey =
  /** CSS url() of a tileable pattern */
  | "--brand-pattern"
  /** box-shadow for hero/feature panels */
  | "--brand-shadow"
  /** border-radius for a hero panel (e.g. an arch) */
  | "--brand-radius-hero";

export interface ThemeBrand {
  /** next/font `.variable` classes (display + body); put on an ancestor of anything using the font vars */
  fontClassName: string;
  /** CSS custom properties; apply as `style` on the same element */
  cssVars: Record<`--brand-${string}`, string> &
    Record<BrandTokenKey, string> &
    Partial<Record<OptionalBrandTokenKey, string>>;
}

/**
 * A theme is the public site's look, layout and motion. Routes in
 * `src/app/(site)/` stay thin: they fetch `SiteContent` and hand it to these.
 */
export interface ThemeModule {
  id: string;
  /** brand tokens shared with the admin panel, so it looks like the site */
  brand: ThemeBrand;
  /** wraps every public page: fonts, CSS variables, nav, footer */
  SiteShell: ComponentType<{ content: SiteContent; children: ReactNode }>;
  HomePage: ComponentType<{ content: SiteContent }>;
  CollectionPage: ComponentType<{ content: SiteContent; collection: Collection; items: MediaItem[] }>;
  /**
   * Optional body for `notFound()` inside the public site. Rendered inside
   * `SiteShell`, so it receives no props.
   */
  NotFoundPage?: ComponentType;
}
