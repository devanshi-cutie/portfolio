import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { imageUrl } from "@/core/cloudinary/urls";
import { siteUrl } from "@/core/config/env";
import { getSiteContent } from "@/core/data/site";
import theme from "@/themes/active";

export async function generateMetadata(): Promise<Metadata> {
  const { settings, mediaById } = await getSiteContent();
  const { seo, identity } = settings;
  const og = seo.ogImageMediaId ? mediaById[seo.ogImageMediaId] : undefined;
  const ogUrl = og ? imageUrl(og, { width: 1200, height: 630, crop: "fill", gravity: "face" }) : undefined;
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
      images: ogUrl ? [{ url: ogUrl, width: 1200, height: 630, alt: identity.name }] : undefined,
    },
    twitter: { card: ogUrl ? "summary_large_image" : "summary", title, description },
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
  return <theme.SiteShell content={content}>{children}</theme.SiteShell>;
}
