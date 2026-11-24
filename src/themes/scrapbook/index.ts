import type { ThemeModule } from "../types";
import { brand } from "./brand";
import { CollectionPage } from "./CollectionPage";
import { HomePage } from "./HomePage";
import { NotFoundPage } from "./NotFoundPage";
import { SiteShell } from "./SiteShell";

/**
 * "scrapbook": an editorial scrapbook for Devanshi Jain in the Pink City
 * palette. Cream paper, Fraunces headings with italic accents, phone-framed
 * reels, stamps, film strips, polaroids, arches and a jaali lattice.
 * Brief: docs/THEME-SCRAPBOOK.md (palette and fonts overridden by user feedback).
 */
const scrapbook: ThemeModule = {
  id: "scrapbook",
  brand,
  SiteShell,
  HomePage,
  CollectionPage,
  NotFoundPage,
};

export default scrapbook;
