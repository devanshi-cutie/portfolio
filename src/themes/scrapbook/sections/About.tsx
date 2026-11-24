import { ArrowUpRight, MapPin } from "lucide-react";
import { imageUrl } from "@/core/cloudinary/urls";
import type { SectionConfig, SiteContent } from "@/core/types/content";
import { Arrow } from "../components/Doodles";
import { MobileClamp } from "../components/MobileClamp";
import { SectionHeading, Tape } from "../components/SectionHeading";
import { labelOf, portraitOf } from "../lib/media";
import { Reveal } from "../motion/Reveal";

export function About({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const { identity } = content.settings;
  const portrait = portraitOf(content);
  const socials = content.settings.socials.filter((s) => s.url);
  const paragraphs = identity.longBio.split(/\n{2,}/).filter(Boolean);

  return (
    <section id="about" aria-labelledby="about-title" className="relative px-(--gutter) py-12 md:py-28">
      <div className="mx-auto grid max-w-[1320px] items-center gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-14 lg:gap-24">
        {portrait ? (
          <Reveal className="relative mx-auto w-full max-w-[min(70vw,260px)] md:max-w-[420px]">
            <figure className="relative rotate-[-2deg]">
              {/* arch-topped portrait in a double rule, like a cut-out pasted onto the page */}
              <div className="rounded-t-[999px] border-[1.5px] border-(--rose-deep) p-2.5">
                <div className="aspect-[4/5] overflow-hidden rounded-t-[999px] bg-(--cream-2)">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary crops to the face */}
                  <img
                    src={imageUrl(portrait, { width: 800, height: 1000, crop: "fill", gravity: "face" })}
                    alt={labelOf(portrait)}
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover object-[50%_25%]"
                  />
                </div>
              </div>
              <Tape className="absolute -top-3 left-1/2 -translate-x-1/2 rotate-[4deg]">{identity.location}</Tape>
              <figcaption className="sb-accent absolute -bottom-9 -right-1 rotate-[-6deg] text-[1.35rem] text-(--rose-deep) md:-bottom-10 md:-right-10 md:text-[1.6rem]">
                hi, it&apos;s me
              </figcaption>
              <Arrow className="absolute -bottom-6 right-24 size-10 rotate-[200deg] text-(--rose-deep) md:right-16 md:size-12" />
            </figure>
          </Reveal>
        ) : null}

        <div className="min-w-0">
          <SectionHeading id="about-title" section={section} size="md" />
          {identity.shortBio ? (
            <Reveal>
              <p className="sb-serif mt-6 text-[clamp(1.2rem,2.2vw,1.65rem)] italic leading-snug text-(--ink) md:mt-8">
                {identity.shortBio}
              </p>
            </Reveal>
          ) : null}
          {paragraphs.length ? (
            <MobileClamp moreLabel="Read more" collapsedClassName="max-md:max-h-[8.5rem]">
              {paragraphs.map((p, i) => (
                <p key={i} className="mt-5 max-w-[60ch] text-base leading-relaxed text-(--ink-soft) md:text-[1.0625rem]">
                  {p}
                </p>
              ))}
            </MobileClamp>
          ) : null}
          <Reveal delay={0.1}>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.95rem] md:mt-8 md:gap-y-3">
              {identity.location ? (
                <span className="inline-flex items-center gap-2 font-semibold">
                  <MapPin className="size-4 text-(--rose-deep)" aria-hidden />
                  {identity.location}
                </span>
              ) : null}
              {socials.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 font-semibold text-(--rose-deep) underline decoration-(--blush) decoration-2 underline-offset-[6px] transition-colors duration-150 hover:decoration-(--rose-deep)"
                >
                  {s.label}
                  <ArrowUpRight className="size-4" aria-hidden />
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
