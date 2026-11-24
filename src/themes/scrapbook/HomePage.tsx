import { Fragment, type ComponentType } from "react";
import type { SectionConfig, SectionKey, SiteContent } from "@/core/types/content";
import { FloatingCta } from "./components/FloatingCta";
import { hasContent } from "./lib/sections";
import { About } from "./sections/About";
import { BrandMarquee, Brands } from "./sections/Brands";
import { Bts } from "./sections/Bts";
import { Contact } from "./sections/Contact";
import { Hero } from "./sections/Hero";
import { Highlights } from "./sections/Highlights";
import { Process } from "./sections/Process";
import { Services } from "./sections/Services";
import { Stats } from "./sections/Stats";
import { Testimonials } from "./sections/Testimonials";
import { Work } from "./sections/Work";

type SectionComponent = ComponentType<{ content: SiteContent; section: SectionConfig }>;

const SECTIONS: Partial<Record<SectionKey, SectionComponent>> = {
  hero: Hero,
  work: Work,
  brands: Brands,
  about: About,
  highlights: Highlights,
  stats: Stats,
  process: Process,
  bts: Bts,
  services: Services,
  testimonials: Testimonials,
  contact: Contact,
};

/** Renders `content.sections` in order, skipping keys this theme doesn't know. */
export function HomePage({ content }: { content: SiteContent }) {
  const hasBrands = content.sections.some((s) => s.key === "brands");
  const hasHero = content.sections.some((s) => s.key === "hero");
  const hasContact = content.sections.some((s) => s.key === "contact");
  return (
    <>
      {/* the hero carries the page's h1; without it, keep one for outline and SEO */}
      {hasHero ? null : <h1 className="sr-only">{content.settings.identity.name}</h1>}
      {content.sections.map((section) => {
        const Section = SECTIONS[section.key];
        if (!Section || !hasContent(content, section.key)) return null;
        return (
          <Fragment key={section.key}>
            <Section content={content} section={section} />
            {/* the brand strip sits directly under the hero */}
            {section.key === "hero" && hasBrands ? <BrandMarquee content={content} /> : null}
          </Fragment>
        );
      })}
      {hasContact ? <FloatingCta label={content.settings.contact.ctaLabel || "Work with me"} /> : null}
    </>
  );
}
