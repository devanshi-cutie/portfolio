/*
 * First-party interaction events (clicks the site counts itself, since Vercel
 * custom events aren't on the Hobby plan). Pure and client-safe: the public
 * theme tags elements with `trackAttr(...)`, the server validates against
 * these lists before counting.
 */

/** Events the browser may report. */
export const CLIENT_TRACK_EVENTS = [
  "reel_open",
  "source_link",
  "social_click",
  "email_click",
  "whatsapp_click",
  "media_kit_click",
  "cta_click",
] as const;

/** Every counted event; `contact_sent` is recorded by the server only. */
export const TRACK_EVENTS = [...CLIENT_TRACK_EVENTS, "contact_sent"] as const;

export type ClientTrackEvent = (typeof CLIENT_TRACK_EVENTS)[number];
export type TrackEvent = (typeof TRACK_EVENTS)[number];

export const TRACK_EVENT_LABELS: Record<TrackEvent, string> = {
  reel_open: "Reel opened",
  source_link: "Opened original post",
  social_click: "Social link clicked",
  email_click: "Email link clicked",
  whatsapp_click: "WhatsApp clicked",
  media_kit_click: "Media kit opened",
  cta_click: "Contact button clicked",
  contact_sent: "Contact form sent",
};

/** Longest stored target (matches the analytics_interactions check). */
export const TRACK_TARGET_MAX = 80;

// C0 and C1 control characters (includes \n, \t, DEL).
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * Makes a target safe to store: control characters removed, whitespace
 * collapsed, trimmed, cut to TRACK_TARGET_MAX characters (code points, so an
 * emoji is never split in half).
 */
export function sanitizeTarget(s: string): string {
  const clean = String(s ?? "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(clean);
  return chars.length <= TRACK_TARGET_MAX ? clean : chars.slice(0, TRACK_TARGET_MAX).join("").trimEnd();
}

/** Value for a `data-track` attribute: "event:target" (target sanitized; it may itself contain ":"). */
export function trackAttr(event: ClientTrackEvent, target: string): string {
  return `${event}:${sanitizeTarget(target)}`;
}
