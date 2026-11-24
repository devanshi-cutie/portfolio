import type { SectionKey, SiteContent } from "@/core/types/content";
import { isVideo, isWork } from "./media";

/**
 * Whether a section has anything to show. Section components return null when
 * this is false; the nav uses it so it never links to a missing anchor.
 */
export function hasContent(content: SiteContent, key: SectionKey): boolean {
  const s = content.settings;
  switch (key) {
    case "hero":
    case "about":
    case "contact":
      return true;
    case "work":
      return content.media.some(isWork);
    case "brands":
      return content.brands.length > 0;
    case "highlights":
      return s.highlights.some((h) => h.title);
    case "stats":
      return s.stats.some((x) => x.value);
    case "process":
      return s.process.some((p) => p.title);
    case "services":
      return s.services.some((x) => x.title);
    case "testimonials":
      return content.testimonials.some((t) => t.quote);
    case "bts":
      return content.media.some((m) => m.kind === "bts" || (m.kind === "portrait" && !isVideo(m)));
    default:
      return false;
  }
}
