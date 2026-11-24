import { Fragment } from "react";
import type { Brand, SectionConfig, SiteContent } from "@/core/types/content";
import { Star } from "../components/Doodles";
import { MobileClamp } from "../components/MobileClamp";
import { SectionHeading } from "../components/SectionHeading";
import { imageUrl } from "@/core/cloudinary/urls";
import { cn } from "../lib/cn";
import { resolveMedia } from "../lib/media";
import { Reveal } from "../motion/Reveal";
import { ScrollVelocity } from "../motion/ScrollVelocity";

/** Logo when there is one, otherwise the name set as type. */
function BrandMark({ brand, content, featured }: { brand: Brand; content: SiteContent; featured: boolean }) {
  const logo = resolveMedia(content, brand.logoMediaId);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-sized logo
      <img
        src={imageUrl(logo, { height: 96, crop: "fit" })}
        alt={brand.name}
        loading="lazy"
        decoding="async"
        className={cn("w-auto object-contain mix-blend-multiply", featured ? "h-10" : "h-7")}
      />
    );
  }
  return <>{brand.name}</>;
}

/** Scroll-velocity strip of brand names, directly under the hero. Decorative; the wall below is the list. */
export function BrandMarquee({ content }: { content: SiteContent }) {
  const brands = content.brands;
  if (brands.length < 4) return null;
  return (
    <div className="sb-on-dark relative z-[1] -mx-4 -rotate-[1.4deg] bg-(--rose-deep) py-4 text-(--cream) shadow-[0_14px_30px_-18px_rgb(44_17_25/0.7)] md:py-5">
      <ScrollVelocity className="relative" label="brand ticker">
        {brands.map((b) => (
          <Fragment key={b.id}>
            <span
              className={cn(
                "px-5 md:px-7",
                b.featured
                  ? "sb-display text-[1.9rem] md:text-[2.5rem]"
                  : "sb-condensed text-[1.05rem] font-bold uppercase tracking-[0.04em] md:text-[1.2rem]",
              )}
            >
              {b.name}
            </span>
            <Star className="size-4 shrink-0 text-(--blush) md:size-5" />
          </Fragment>
        ))}
      </ScrollVelocity>
    </div>
  );
}

export function Brands({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const brands = content.brands;
  if (!brands.length) return null;

  // Groups and labels come from settings.brandGroups (admin-editable). A brand
  // shows in every group whose tag it has; brands matching no group go last.
  const defined = (content.settings.brandGroups ?? []).filter((g) => g.tag);
  const groups: { key: string; label: string | null; items: Brand[] }[] = defined
    .map((g) => ({ key: g.tag, label: g.label || g.tag, items: brands.filter((b) => b.tags.includes(g.tag)) }))
    .filter((g) => g.items.length > 0);
  const tags = new Set(defined.map((g) => g.tag));
  const rest = brands.filter((b) => !b.tags.some((t) => tags.has(t)));
  if (rest.length) groups.push({ key: "__more", label: groups.length ? "More collaborations" : null, items: rest });

  return (
    <section id="brands" aria-labelledby="brands-title" className="relative px-(--gutter) py-12 md:py-28">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeading id="brands-title" section={section} />
        <div className={cn("mt-10 grid gap-10 md:mt-14 md:gap-14", groups.length > 1 && "lg:grid-cols-2 lg:gap-20")}>
          {groups.map((g, gi) => (
            <Reveal key={g.key} delay={gi * 0.06}>
              {g.label ? (
                <>
                  <h3 className="sb-accent text-[1.9rem] leading-none text-(--rose-deep)">{g.label}</h3>
                  <p className="mt-1 text-sm text-(--ink-soft)">{g.items.length} brands</p>
                </>
              ) : null}
              <MobileClamp moreLabel={`Show all ${g.items.length} brands`} collapsedClassName="max-md:max-h-[8.75rem]">
                <ul className="mt-4 flex flex-wrap items-baseline gap-x-1 gap-y-2 md:mt-6 md:gap-y-3">
                  {g.items.map((b, i) => (
                    <li key={b.id} className="inline-flex items-center gap-1">
                      {b.websiteUrl ? (
                        <a
                          href={b.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(brandClass(b.featured), "min-h-11 underline-offset-4 hover:underline")}
                        >
                          <BrandMark brand={b} content={content} featured={b.featured} />
                        </a>
                      ) : (
                        <span className={brandClass(b.featured)}>
                          <BrandMark brand={b} content={content} featured={b.featured} />
                        </span>
                      )}
                      {i < g.items.length - 1 ? <Star className="size-3 shrink-0 text-(--terracotta)/60" /> : null}
                    </li>
                  ))}
                </ul>
              </MobileClamp>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const brandClass = (featured: boolean) =>
  cn(
    "inline-flex items-center px-1.5",
    featured
      ? "sb-display text-[clamp(1.75rem,3.2vw,2.6rem)] text-(--rose-deep)"
      : "sb-condensed text-[1.05rem] font-bold uppercase tracking-[0.03em] text-(--ink) md:text-[1.15rem]",
  );
