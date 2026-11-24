import type { Metadata } from "next";
import { siteUrl } from "@/core/config/env";
import { getSiteContent } from "@/core/data/site";
import theme from "@/themes/active";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomeRoute() {
  const content = await getSiteContent();
  const { identity, socials } = content.settings;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: identity.name,
    jobTitle: identity.role,
    description: identity.shortBio || identity.tagline,
    url: siteUrl(),
    address: identity.location ? { "@type": "PostalAddress", addressLocality: identity.location } : undefined,
    sameAs: socials.map((s) => s.url).filter(Boolean),
  };
  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so admin-edited copy can never close the script tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <theme.HomePage content={content} />
    </>
  );
}
