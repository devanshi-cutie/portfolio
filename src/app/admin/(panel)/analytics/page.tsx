import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { getAnalyticsStatus } from "@/core/analytics/config";
import { ANALYTICS_RANGES, type AnalyticsRange } from "@/core/analytics/types";
import { getAnalyticsOverview } from "@/core/data/analytics";
import { AnalyticsManager } from "@/core/admin/analytics/analytics-manager";
import { PageHeader } from "@/core/admin/ui/misc";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

/** Server Actions take their time limit from the page they're used on; a sync can make several Vercel requests. */
export const maxDuration = 60;

export const metadata: Metadata = { title: "Analytics" };

const DEFAULT_RANGE: AnalyticsRange = "30d";

function parseRange(value: string | string[] | undefined): AnalyticsRange {
  const raw = Array.isArray(value) ? value[0] : value;
  return ANALYTICS_RANGES.find((r) => r === raw) ?? DEFAULT_RANGE;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const range = parseRange((await searchParams).range);
  const [status, overview] = await Promise.all([getAnalyticsStatus(), getAnalyticsOverview(range)]);
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Visits from Vercel Web Analytics, and the clicks your site counts itself."
      />
      <AnalyticsManager status={status} overview={overview} />
    </>
  );
}
