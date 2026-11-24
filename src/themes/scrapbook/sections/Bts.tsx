import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { SectionConfig, SiteContent } from "@/core/types/content";
import { BtsBoard } from "../components/BtsBoard";
import { SectionHeading } from "../components/SectionHeading";
import { indexContent, instagramUrl, isVideo, metaOf } from "../lib/media";

export function Bts({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const items = content.media.filter((m) => m.kind === "bts");
  if (!items.length) return null;
  const photos = items.filter((m) => !isVideo(m));
  const clips = items.filter(isVideo);
  const idx = indexContent(content);
  const metas = Object.fromEntries(items.map((m) => [m.id, metaOf(m, idx.brands, idx.collections)]));
  const collection = content.collections.find((c) => items.some((m) => m.collectionId === c.id));

  return (
    <section id="bts" aria-labelledby="bts-title" className="relative px-(--gutter) py-12 md:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading id="bts-title" section={section} />
          {collection ? (
            <Link
              href={`/work/${collection.slug}`}
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-(--rose-deep) underline decoration-(--blush) decoration-2 underline-offset-[6px] hover:decoration-(--rose-deep)"
            >
              All behind-the-scenes
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
        <div className="mt-12">
          <BtsBoard photos={photos} clips={clips} metas={metas} instagram={instagramUrl(content)} />
        </div>
      </div>
    </section>
  );
}
