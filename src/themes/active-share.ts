/**
 * The active theme's social preview card (used by src/app/(site)/opengraph-image.tsx
 * and twitter-image.tsx). Kept separate from ./active.ts so the image route doesn't
 * import the theme's client components and next/font. Switch it together with ./active.ts.
 */
export { renderShareCard } from "./scrapbook/share-card";
