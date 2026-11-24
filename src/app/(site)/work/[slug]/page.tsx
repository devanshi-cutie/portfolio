import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollectionWork, getSiteContent } from "@/core/data/site";
import theme from "@/themes/active";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const { collections, media } = await getSiteContent();
  const slugs = collections
    .filter((c) => media.some((m) => m.collectionId === c.id))
    .map((c) => ({ slug: c.slug }));
  // Cache Components needs at least one param; an unknown slug renders the 404.
  return slugs.length ? slugs : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const work = await getCollectionWork(slug);
  if (!work) return { title: "Not found", robots: { index: false } };
  const { collection } = work;
  return {
    title: collection.title,
    description: collection.description ?? undefined,
    alternates: { canonical: `/work/${collection.slug}` },
    openGraph: { title: collection.title, description: collection.description ?? undefined },
  };
}

export default async function CollectionRoute({ params }: Params) {
  const { slug } = await params;
  const [content, work] = await Promise.all([getSiteContent(), getCollectionWork(slug)]);
  if (!work) notFound();
  return <theme.CollectionPage content={content} collection={work.collection} items={work.items} />;
}
