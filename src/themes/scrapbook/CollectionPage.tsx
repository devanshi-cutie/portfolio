import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Collection, MediaItem, SiteContent } from "@/core/types/content";
import { buttonClass } from "./components/Button";
import { SectionHeading } from "./components/SectionHeading";
import { WorkGrid } from "./components/WorkGrid";
import { indexContent, instagramUrl, isVideo, metaOf } from "./lib/media";

export function CollectionPage({
  content,
  collection,
  items,
}: {
  content: SiteContent;
  collection: Collection;
  items: MediaItem[];
}) {
  const idx = indexContent(content);
  const metas = Object.fromEntries(items.map((m) => [m.id, metaOf(m, idx.brands, idx.collections)]));
  const videos = items.filter(isVideo).length;
  const photos = items.length - videos;
  const counts = [videos && `${videos} ${videos === 1 ? "video" : "videos"}`, photos && `${photos} ${photos === 1 ? "photo" : "photos"}`]
    .filter(Boolean)
    .join(" and ");
  const others = content.collections.filter(
    (c) => c.id !== collection.id && content.media.some((m) => m.collectionId === c.id),
  );
  const hasContact = content.sections.some((s) => s.key === "contact");

  return (
    <>
      <section aria-labelledby="collection-title" className="px-(--gutter) pb-16 pt-[calc(var(--nav-h)+2rem)] md:pt-[calc(var(--nav-h)+3rem)]">
        <div className="mx-auto max-w-[1320px]">
          <Link
            href="/#work"
            className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] font-semibold text-(--ink) hover:text-(--rose-deep)"
          >
            <ArrowLeft className="size-4" aria-hidden />
            All work
          </Link>
          <div className="mt-6">
            <SectionHeading
              id="collection-title"
              as="h1"
              section={{ title: collection.title, eyebrow: "", subtitle: collection.description ?? "" }}
            />
            {counts ? <p className="mt-3 text-sm font-semibold text-(--ink-soft)">{counts}</p> : null}
          </div>
          <div className="mt-10">
            {items.length ? (
              <WorkGrid
                items={items}
                metas={metas}
                handle={content.settings.identity.handle}
                instagram={instagramUrl(content)}
                initial={items.length}
                noun={videos ? "Reel" : "Photo"}
              />
            ) : (
              <p className="sb-serif py-16 text-xl italic text-(--ink-soft)">Nothing here yet. New work is on its way.</p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="more-title" className="bg-(--cream-2) px-(--gutter) py-16 md:py-20">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-10 md:flex-row md:items-end md:justify-between">
          {others.length ? (
            <div>
              <h2 id="more-title" className="sb-accent text-[2.2rem] leading-none text-(--rose-deep)">
                More work
              </h2>
              <ul className="mt-5 flex flex-wrap gap-2">
                {others.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/work/${c.slug}`}
                      className="inline-flex min-h-11 items-center rounded-full border border-(--ink)/30 bg-(--cream) px-4 text-sm font-semibold transition-colors duration-150 hover:border-(--ink) hover:bg-(--card)"
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <h2 id="more-title" className="sr-only">
              Next step
            </h2>
          )}
          {hasContact ? (
            <Link href="/#contact" className={buttonClass("primary", "group self-start md:self-auto")}>
              {content.settings.contact.ctaLabel || "Work with me"}
              <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
