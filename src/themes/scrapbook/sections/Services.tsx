import { ArrowUpRight } from "lucide-react";
import type { SectionConfig, SiteContent } from "@/core/types/content";
import { SectionHeading } from "../components/SectionHeading";
import { SwipeList } from "../components/SwipeList";
import { Reveal } from "../motion/Reveal";

/** A printed menu: one row per service, deliverables as ticket stubs. */
export function Services({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const services = content.settings.services.filter((s) => s.title);
  if (!services.length) return null;
  const kit = content.settings.contact.mediaKitUrl;

  return (
    <section id="services" aria-labelledby="services-title" className="relative px-(--gutter) py-12 md:py-28">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeading id="services-title" section={section} />
        <SwipeList label={section.title || "Services"} className="mt-8 md:mt-12" desktopClassName="md:block">
          {services.map((s, i) => (
            <Reveal amount={0} key={s.title} delay={Math.min(i * 0.05, 0.2)} className="h-full">
              <article className="grid h-full content-start gap-5 rounded-sm border border-(--rose-deep)/25 bg-(--card) p-6 md:grid-cols-[1fr_1.1fr] md:gap-12 md:rounded-none md:border-0 md:border-t-2 md:border-dashed md:border-(--rose-deep)/35 md:bg-transparent md:px-0 md:py-12">
                <div>
                  <h3 className="sb-display text-[clamp(2rem,5vw,4rem)] text-(--rose-deep)">{s.title}</h3>
                  <p className="mt-3 max-w-[46ch] text-base leading-relaxed text-(--ink-soft) md:mt-4 md:text-[1.0625rem]">{s.description}</p>
                </div>
                {s.deliverables.length ? (
                  <div className="md:pt-2">
                    <p className="sb-accent text-[1.4rem] leading-none text-(--ink)">You get</p>
                    <ul className="mt-4 flex flex-wrap gap-2.5">
                      {s.deliverables.map((d) => (
                        <li
                          key={d}
                          className="relative rounded-[4px] border border-(--ink)/80 bg-(--card) px-4 py-2 text-[0.95rem] font-semibold before:absolute before:-left-1.5 before:top-1/2 before:size-3 before:-translate-y-1/2 before:rounded-full before:border-r before:border-(--ink)/80 before:bg-(--cream) after:absolute after:-right-1.5 after:top-1/2 after:size-3 after:-translate-y-1/2 after:rounded-full after:border-l after:border-(--ink)/80 after:bg-(--cream)"
                        >
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            </Reveal>
          ))}
        </SwipeList>
        {kit ? (
          <div className="mt-6 md:mt-0 md:border-t-2 md:border-dashed md:border-(--rose-deep)/35 md:pt-8">
            <a
              href={kit}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-(--rose-deep) underline decoration-(--blush) decoration-2 underline-offset-[6px] hover:decoration-(--rose-deep)"
            >
              See the full media kit
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
