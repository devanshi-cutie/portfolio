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
          <h1 id="hero-title" className="sb-display sb-rise text-balance text-[clamp(3.1rem,8.4vw,7.25rem)] md:mt-7" style={d(60)}>
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

          {contact.availability ? (
            /* A margin note instead of a status pill: a hand-drawn arrow curls up to the
               main button and the availability line gets an underline that draws itself. */
            <p className="sb-rise relative mt-4 flex max-w-[32ch] items-start gap-2 pl-1 md:mt-5" style={d(300)}>
              <svg
                viewBox="0 0 56 48"
                aria-hidden
                className="sb-draw mt-[-0.35rem] h-9 w-11 shrink-0 text-(--rose-deep) md:h-10 md:w-12"
                style={d(700)}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path pathLength={1} d="M50 42C36 41 22 35 14 25 9 19 7 12 7 5" />
                <path pathLength={1} d="M2.5 11.5C4 9 5.6 6.6 7 4.2c2 2.2 4.3 4.3 6.8 6" />
              </svg>
              <span className="sb-accent relative text-[1.05rem] leading-snug text-(--rose-deep) md:text-[1.15rem]">
                {contact.availability}
                <svg
                  viewBox="0 0 220 12"
                  aria-hidden
                  preserveAspectRatio="none"
                  className="sb-draw absolute -bottom-2 left-0 h-2.5 w-[min(100%,15rem)] text-(--rose)"
                  style={d(1000)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                >
                  <path pathLength={1} d="M3 8c34-4 71-6 110-5 36 1 70 2 104 0" />
                </svg>
              </span>
            </p>
          ) : null}
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
