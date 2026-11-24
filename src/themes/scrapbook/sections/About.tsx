import { ArrowUpRight, MapPin } from "lucide-react";
import { imageUrl } from "@/core/cloudinary/urls";
import type { SectionConfig, SiteContent } from "@/core/types/content";
import { Arrow } from "../components/Doodles";
import { MobileClamp } from "../components/MobileClamp";
import { Jharokha } from "../components/jaipur/Jharokha";
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
          // no Reveal here: the jharokha runs its own entrance and shows finished without JS
          <div className="relative w-[calc(100%_+_1rem)] max-w-[360px] max-md:mx-[max(-0.5rem,calc((100%_-_360px)/2))] md:mx-auto md:w-full md:max-w-[540px]">
            <figure className="relative rotate-[-2deg]">
              {/* the portrait set in a Hawa Mahal jharokha (window) standing behind it */}
              <Jharokha>
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
              </Jharokha>
              <Tape className="absolute -left-1 top-[9.5%] z-[1] -rotate-[8deg] md:-left-3">{identity.location}</Tape>
              <figcaption className="sb-accent absolute -bottom-7 right-1 rotate-[-6deg] text-[1.35rem] text-(--rose-deep) md:-bottom-8 md:-right-6 md:text-[1.6rem]">
                hi, it&apos;s me
              </figcaption>
              <Arrow className="absolute -bottom-3 right-[29%] size-10 rotate-[200deg] text-(--rose-deep) md:size-12" />
            </figure>
          </div>
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
