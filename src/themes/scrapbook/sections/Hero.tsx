import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import type { SectionConfig, SiteContent } from "@/core/types/content";
import { ButtonLink } from "../components/Button";
import { Swash } from "../components/Doodles";
import { HeroStack } from "../components/HeroStack";
import { heroReels, indexContent, instagramUrl, metaOf } from "../lib/media";
import { Magnet } from "../motion/Magnet";
import { RotatingText } from "../motion/RotatingText";

/** CSS entrance delay; hero entrances are CSS so text shows before hydration. */
const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function Hero({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const { identity, contact } = content.settings;
  const reels = heroReels(content);
  const idx = indexContent(content);
  const metas = Object.fromEntries(reels.map((m) => [m.id, metaOf(m, idx.brands, idx.collections)]));
  const keywords = identity.keywords.filter(Boolean);
  const name = section.title || identity.name;
  const [first, ...restWords] = name.trim().split(/\s+/);
  const rest = restWords.join(" ");
  const hasContact = content.sections.some((s) => s.key === "contact");
  const ig = instagramUrl(content);
  const city = identity.location.split(",")[0]?.trim();
  const badge = `${identity.role} • ${city ? `${city} • ` : ""}`;

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative px-(--gutter) pb-10 pt-[calc(var(--nav-h)+1rem)] md:pb-20 md:pt-[calc(var(--nav-h)+2.5rem)]"
    >
      <div className="mx-auto grid max-w-[1320px] items-center gap-8 md:gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
        <div className="relative min-w-0">
          {contact.availability ? (
            <p
              className="sb-rise inline-flex max-w-full items-center gap-2.5 rounded-full border border-(--line) bg-(--card) px-3.5 py-1.5 text-[0.78rem] font-semibold md:px-4 md:py-2 md:text-[0.8125rem]"
              style={d(0)}
            >
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inset-0 rounded-full bg-[#2f8f5b] motion-safe:animate-ping motion-safe:[animation-duration:2.4s]" />
                <span className="relative size-2 rounded-full bg-[#2f8f5b]" />
              </span>
              {contact.availability}
            </p>
          ) : null}

          <h1 id="hero-title" className="sb-display sb-rise mt-5 text-balance text-[clamp(3.1rem,8.4vw,7.25rem)] md:mt-7" style={d(60)}>
            {first}
            {rest ? (
              <>
                {" "}
                <em className="sb-accent text-(--rose-deep)">{rest}</em>
              </>
            ) : null}
          </h1>

          <p className="sb-accent sb-rise mt-3 text-[clamp(1.45rem,3vw,2.25rem)] leading-tight md:mt-5" style={d(120)}>
            {identity.role}
            {keywords.length ? (
              <>
                {" "}for{" "}
                <span className="relative inline-block not-italic">
                  <RotatingText words={keywords} className="sb-serif font-semibold not-italic text-(--rose-deep)" />
                  <Swash className="absolute -bottom-2 left-0 h-3 w-full text-(--rose)" />
                </span>{" "}
                brands
              </>
            ) : null}
          </p>

          {identity.tagline ? (
            <p
              className="sb-rise mt-4 max-w-[40ch] text-base leading-relaxed text-(--ink-soft) md:mt-6 md:text-lg"
              style={d(180)}
            >
              {identity.tagline}
            </p>
          ) : null}

          <div className="sb-rise mt-6 flex flex-wrap items-center gap-3 md:mt-9" style={d(240)}>
            {hasContact ? (
              <Magnet>
                <ButtonLink href="#contact" variant="primary" className="group">
                  {contact.ctaLabel || "Work with me"}
                  <ArrowRight
                    className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </ButtonLink>
              </Magnet>
            ) : null}
            <ButtonLink href={ig} external variant="ghost">
              @{identity.handle}
            </ButtonLink>
          </div>
        </div>

        <div className="relative">
          {/* Jaipur nod: an arched window with a faint jaali lattice behind the reels */}
          <div
            aria-hidden
            className="absolute inset-x-[10%] bottom-[8%] top-[6%] mx-auto max-w-[460px] overflow-hidden rounded-t-[999px] border border-(--rose)/50 bg-(--cream-2) md:inset-x-[6%] md:bottom-[-4%]"
          >
            <div className="sb-jaali absolute inset-0 opacity-[0.14]" />
          </div>
          <HeroStack reels={reels} metas={metas} handle={identity.handle} badge={badge} instagram={ig} />
        </div>
      </div>
    </section>
  );
}
