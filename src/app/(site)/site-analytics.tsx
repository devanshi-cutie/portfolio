"use client";

/*
 * Vercel Web Analytics for the public site. beforeSend is a function prop, so
 * it lives in this client wrapper; admin URLs are dropped as a safety net.
 */
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

function dropAdmin(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    return new URL(event.url, window.location.origin).pathname.startsWith("/admin") ? null : event;
  } catch {
    return event;
  }
}

export function SiteAnalytics() {
  return <Analytics beforeSend={dropAdmin} />;
}
