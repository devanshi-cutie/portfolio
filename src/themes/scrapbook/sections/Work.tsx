import type { SectionConfig, SiteContent } from "@/core/types/content";
import { SectionHeading } from "../components/SectionHeading";
import { WorkGrid, type Chip } from "../components/WorkGrid";
import { indexContent, instagramUrl, isWork, metaOf } from "../lib/media";

export function Work({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const items = content.media.filter(isWork);
  if (!items.length) return null;
  const idx = indexContent(content);
  const metas = Object.fromEntries(items.map((m) => [m.id, metaOf(m, idx.brands, idx.collections)]));
  const chips: Chip[] = content.collections
    .map((c) => ({ id: c.id, slug: c.slug, title: c.title, count: items.filter((m) => m.collectionId === c.id).length }))
    .filter((c) => c.count > 0);

  return (
    <section id="work" aria-labelledby="work-title" className="relative px-(--gutter) py-12 md:py-28">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeading id="work-title" section={section} eyebrow />
        <div className="mt-10">
          <WorkGrid
            items={items}
            metas={metas}
            chips={chips}
            handle={content.settings.identity.handle}
            instagram={instagramUrl(content)}
          />
        </div>
      </div>
    </section>
  );
}
