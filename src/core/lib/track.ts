/*
 * Reports one first-party interaction to /api/track. Client-safe and
 * fire-and-forget: it never throws, never awaits, and does nothing on the
 * server, outside production builds, on a local host, or on admin pages.
 */
import { sanitizeTarget, type ClientTrackEvent } from "./track-events";

const ENDPOINT = "/api/track";

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

/** sendBeacon with a plain string (sent as text/plain, CORS-safelisted); false if missing, refused or thrown. */
function beacon(json: string): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
      ? navigator.sendBeacon(ENDPOINT, json)
      : false;
  } catch {
    return false;
  }
}

export function track(event: ClientTrackEvent, target = ""): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;
  try {
    const { pathname, hostname } = window.location;
    if (pathname.startsWith("/admin") || isLocalHost(hostname)) return;
    const json = JSON.stringify({ event, target: sanitizeTarget(target) });
    if (beacon(json)) return;
    fetch(ENDPOINT, {
      method: "POST",
      body: json,
      headers: { "content-type": "text/plain;charset=UTF-8" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics must never break the page
  }
}
