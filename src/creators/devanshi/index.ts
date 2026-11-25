import type { CreatorPackage } from "@/creators/types";
import { brands, collections, media, settings, settingsMedia, testimonials } from "./content";
import { DEVANSHI_ID } from "./id";

/**
 * Devanshi Jain — UGC creator, Jaipur.
 * Sources: her Canva portfolio (stratusloc.my.canva.site/devanshi-jain), her
 * Instagram bio (@devanshyyii, Nov 2026) and the files in /data.
 */
const devanshi: CreatorPackage = {
  id: DEVANSHI_ID,
  settings,
  settingsMedia,
  collections,
  brands,
  testimonials,
  media,
};

export default devanshi;
