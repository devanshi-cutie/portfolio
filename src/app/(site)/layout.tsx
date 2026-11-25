import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/core/config/env";
import { getSiteContent } from "@/core/data/site";
import theme from "@/themes/active";
import { SiteAnalytics } from "./site-analytics";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteContent();
  const { seo, identity } = settings;
  const title = seo.title || `${identity.name} | ${identity.role}`;
  const description = seo.description || identity.tagline;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s | ${identity.name}` },
    description,
    openGraph: {
      type: "website",
      siteName: identity.name,
      title,
      description,
      // the image comes from ./opengraph-image.tsx (the theme's share card)
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const viewport: Viewport = {
  themeColor: theme.brand.cssVars["--brand-bg"],
  colorScheme: "light",
  // let the theme paint edge to edge; it pads with env(safe-area-inset-*)
  viewportFit: "cover",
};

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const content = await getSiteContent();
  return (
    <>
      <theme.SiteShell content={content}>{children}</theme.SiteShell>
      {/* client-only; its own Suspense boundary keeps the site prerendered */}
      <SiteAnalytics />
    </>
  );
}
