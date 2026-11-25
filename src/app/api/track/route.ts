import { after } from "next/server";
import { z } from "zod";
import { isValidTarget, normalizeTarget, recordInteraction } from "@/core/analytics/interactions";
import { CLIENT_TRACK_EVENTS } from "@/core/lib/track-events";

/**
 * First-party click counter for the public site (src/core/lib/track.ts).
 * Body: `{ event, target? }`. Always answers 204 with no body, whether the
 * hit was counted or dropped, so it tells a caller nothing. Nothing about the
 * visitor is stored: the IP lives only in this instance's throttle map, the
 * user agent is only tested against a bot pattern.
 */

const NO_STORE = { "Cache-Control": "no-store" };

const noContent = () => new Response(null, { status: 204, headers: NO_STORE });

const MAX_BODY_BYTES = 1024;
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;

/** `contact_sent` is not a client event: only the contact form action counts it. */
const bodySchema = z.object({
  event: z.enum(CLIENT_TRACK_EVENTS),
  target: z.string().max(200).optional(),
});

/**
 * Best-effort per-IP throttle (per server instance; serverless instances do not
 * share it): a fixed window of WINDOW_MS, MAX_PER_WINDOW hits. Above
 * MAX_TRACKED_IPS the oldest entries are evicted, so rotating IPs can't wipe
 * everyone else's state.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 60;
const MAX_TRACKED_IPS = 5000;
const hits = new Map<string, { start: number; count: number }>();

function throttled(ip: string, now: number): boolean {
  const entry = hits.get(ip);
  if (entry && now - entry.start < WINDOW_MS) {
    entry.count++;
    return entry.count > MAX_PER_WINDOW;
  }
  // new or expired window: re-insert so Map order stays oldest-window-first
  hits.delete(ip);
  hits.set(ip, { start: now, count: 1 });
  while (hits.size > MAX_TRACKED_IPS) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
  return false;
}

/** The request's own host (Vercel sets x-forwarded-host to the public host). */
function requestHost(headers: Headers): string {
  const raw = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  return raw.split(",")[0].trim().toLowerCase();
}

/** A cross-site Origin (or an unparsable one, like "null") is dropped; no Origin is allowed. */
function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (origin === null) return true;
  const host = requestHost(headers);
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

/** The body as text, or null when it is larger than MAX_BODY_BYTES (stops reading past the limit). */
async function readSmallBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isFinite(size) || size > MAX_BODY_BYTES) return null;
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readEvent(request: Request): Promise<{ event: z.infer<typeof bodySchema>["event"]; target: string } | null> {
  const text = await readSmallBody(request);
  if (text === null) return null;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return null;

  // per-event target shape: a media uuid for reel_open/source_link, else a short slug
  const target = normalizeTarget(parsed.data.target ?? "");
  return isValidTarget(parsed.data.event, target) ? { event: parsed.data.event, target } : null;
}

export async function POST(request: Request) {
  // Only the production deployment counts (not previews, not a local `next start`).
  if (process.env.VERCEL_ENV !== "production") return noContent();

  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return noContent();
  if (!sameOrigin(request.headers)) return noContent();

  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
  if (throttled(ip, Date.now())) return noContent();

  const hit = await readEvent(request);
  if (!hit) return noContent();

  const { event, target } = hit;
  // counted after the response is sent; recordInteraction never throws
  after(() => recordInteraction(event, target));
  return noContent();
}
