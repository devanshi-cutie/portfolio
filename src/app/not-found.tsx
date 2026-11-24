import Link from "next/link";
import type { CSSProperties } from "react";
import theme from "@/themes/active";

/**
 * Root 404 for URLs that match no route. It renders outside the public
 * SiteShell (no data fetching here), so it styles itself only with the active
 * theme's brand tokens, with neutral fallbacks.
 */
export default function NotFound() {
  return (
    <main
      className={theme.brand.fontClassName}
      style={
        {
          ...theme.brand.cssVars,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "var(--brand-bg, #fafafa)",
          color: "var(--brand-ink, #18181b)",
          fontFamily: "var(--brand-font-body, system-ui, sans-serif)",
          textAlign: "center",
        } as CSSProperties
      }
    >
      <div>
        <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0, color: "var(--brand-ink-soft, #52525b)" }}>404</p>
        <h1
          style={{
            fontFamily: "var(--brand-font-display, Georgia, serif)",
            fontWeight: 500,
            fontSize: "clamp(2.25rem, 6vw, 3.5rem)",
            lineHeight: 1.1,
            margin: "0.75rem 0 1.5rem",
          }}
        >
          This page doesn&apos;t exist.
        </h1>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 48,
            padding: "0 1.5rem",
            borderRadius: 999,
            background: "var(--brand-primary, #18181b)",
            color: "var(--brand-primary-ink, #fafafa)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
