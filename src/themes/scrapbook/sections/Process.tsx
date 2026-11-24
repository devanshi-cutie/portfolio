import type { SectionConfig, SiteContent } from "@/core/types/content";
import { SectionHeading } from "../components/SectionHeading";
import { SwipeList } from "../components/SwipeList";
import { cn } from "../lib/cn";
import { Reveal } from "../motion/Reveal";
import { stagger } from "../motion/stagger";

/**
 * The process as a strip of film: frames read left to right on wide screens
 * and top to bottom on phones, developing in sequence as the strip arrives.
 */
export function Process({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const steps = content.settings.process.filter((s) => s.title);
  if (!steps.length) return null;
  const cols = steps.length <= 3 ? "md:grid-cols-3" : steps.length === 4 ? "md:grid-cols-4" : "md:grid-cols-5";

  return (
    <section id="process" aria-labelledby="process-title" className="relative py-12 md:py-28">
      <div className="mx-auto max-w-[1320px] px-(--gutter)">
        <SectionHeading id="process-title" section={section} eyebrow />
      </div>

      <div className="mt-10 md:mt-14 md:-rotate-1">
        <div className="sb-film px-(--gutter)">
          <SwipeList
            as="ol"
            label={section.title || "Process"}
            tone="dark"
            slideWidth="w-[78%]"
            className="mx-auto max-w-[1320px]"
            desktopClassName={cn("md:grid md:gap-4", cols)}
          >
            {steps.map((s, i) => (
              <Reveal amount={0} key={s.title} delay={stagger(i, 0.06)} className="h-full">
                <article className="flex h-full min-h-[14rem] flex-col rounded-[3px] bg-(--card) p-5 md:min-h-[17rem] md:p-6">
                  <p aria-hidden className="text-[0.7rem] font-semibold tracking-[0.18em] text-(--rose-deep)/70">
                    {String(i + 1).padStart(2, "0")}A
                  </p>
                  <h3 className="sb-display mt-auto pt-6 text-[clamp(2rem,3.4vw,2.75rem)] text-(--rose-deep)">{s.title}</h3>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-(--ink-soft)">{s.body}</p>
                </article>
              </Reveal>
            ))}
          </SwipeList>
        </div>
      </div>
    </section>
  );
}
