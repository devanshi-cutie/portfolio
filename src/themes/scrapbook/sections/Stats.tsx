import type { SectionConfig, SiteContent } from "@/core/types/content";
import { SectionHeading } from "../components/SectionHeading";
import { cn } from "../lib/cn";
import { jitter } from "../lib/seed";
import { CountUp } from "../motion/CountUp";
import { Reveal } from "../motion/Reveal";
import { stagger } from "../motion/stagger";

/*
 * Column count follows the number of stats so rows come out even: 4 across for
 * 4/7/8, 3 across for 3/5/6/9, 2 for 2. Items are flex-basis sized (not grid
 * cells) so a short last row sits centred instead of hugging the left.
 * Widths subtract the gap: 1.25rem between columns.
 */
const ITEM_WIDTH_MD: Record<number, string> = {
  1: "md:basis-[min(100%,260px)]",
  2: "md:basis-[calc((100%-1.25rem)/2)]",
  3: "md:basis-[calc((100%-2.5rem)/3)]",
  4: "md:basis-[calc((100%-3.75rem)/4)]",
};

function columnsFor(count: number): number {
  if (count <= 2) return count;
  if (count % 4 === 0 || count === 7) return 4;
  if (count % 3 === 0 || count === 5) return 3;
  return 4;
}

/** Numbers as postmarks: a double ring, the figure counting up inside. */
export function Stats({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const stats = content.settings.stats.filter((s) => s.value);
  if (!stats.length) return null;
  const cols = columnsFor(stats.length);

  return (
    <section id="stats" aria-labelledby="stats-title" className="relative bg-(--cream-2) px-(--gutter) py-12 md:py-24">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeading id="stats-title" section={section} align="center" size="md" />
        <ul
          className={cn(
            "mx-auto mt-10 flex max-w-[1100px] flex-wrap justify-center gap-x-5 gap-y-8 md:mt-14 md:gap-y-12",
            cols === 3 && "md:max-w-[860px]",
          )}
        >
          {stats.map((s, i) => (
            <Reveal
              as="li"
              key={`${i}-${s.label}`}
              delay={stagger(i, 0.06)}
              className={cn(
                "flex min-w-0 grow-0 basis-[calc((100%-1.25rem)/2)] flex-col items-center text-center",
                ITEM_WIDTH_MD[cols],
              )}
            >
              <div
                className="grid aspect-square w-full max-w-[136px] place-items-center rounded-full border-2 border-(--rose-deep) p-1.5 md:max-w-[200px] md:p-2"
                style={{ rotate: `${jitter(s.label, 5)}deg` }}
              >
                <div className="grid size-full place-items-center rounded-full border border-dashed border-(--rose-deep)/60 bg-(--cream)">
                  <p
                    className={cn(
                      "sb-display px-2 text-(--rose-deep)",
                      s.value.length > 4 ? "text-[clamp(1.4rem,3.6vw,2.6rem)]" : "text-[clamp(2.1rem,5.5vw,3.9rem)]",
                    )}
                  >
                    <CountUp value={s.value} />
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-[18ch] text-[0.95rem] font-semibold leading-snug">{s.label}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
