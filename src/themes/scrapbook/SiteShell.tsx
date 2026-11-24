import type { CSSProperties, ReactNode } from "react";
import type { SiteContent } from "@/core/types/content";
import { Footer } from "./components/Footer";
import { Nav, type NavLink } from "./components/Nav";
import { brand } from "./brand";
import { instagramUrl, themeOverrides } from "./lib/media";
import { hasContent } from "./lib/sections";
import { palette, themeVars } from "./palette";
import "./scrapbook.css";

const NAV_LABELS: Partial<Record<string, string>> = {
  work: "Work",
  brands: "Brands",
  about: "About",
  process: "Process",
  services: "Services",
  bts: "BTS",
};

export function SiteShell({ content, children }: { content: SiteContent; children: ReactNode }) {
  const { identity, contact } = content.settings;
  const keys = new Set(content.sections.map((s) => s.key));
  const links: NavLink[] = content.sections
    .filter((s) => NAV_LABELS[s.key] && hasContent(content, s.key))
    .slice(0, 5)
    .map((s) => ({ href: `/#${s.key}`, label: NAV_LABELS[s.key]! }));
  const cta = keys.has("contact") ? { href: "/#contact", label: contact.ctaLabel || "Work with me" } : null;

  return (
    <div
      data-theme="scrapbook"
      className={brand.fontClassName}
      style={{ ...brand.cssVars, ...themeVars, ...themeOverrides(content.settings.theme) } as CSSProperties}
    >
      {/* overscroll/canvas colour behind the shell, from the same palette */}
      <style>{`html:has([data-theme="scrapbook"]){background:${palette.cream}}`}</style>
      {/* Pink City sky: fixed backdrop under all content (z-index -1 in the isolated shell) */}
      <div aria-hidden className="sb-sky" />
      <a
        href="#main"
        className="sr-only z-[90] rounded-full bg-(--ink) px-5 py-3 font-semibold text-(--cream) focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Nav
        name={identity.name}
        links={links}
        cta={cta}
        instagram={instagramUrl(content)}
        handle={identity.handle}
      />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer content={content} />
      <div id="sb-portal" />
      <div aria-hidden className="sb-grain" />
    </div>
  );
}
