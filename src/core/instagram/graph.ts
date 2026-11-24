import "server-only";

/*
 * Minimal client for the Instagram API with Instagram Login (graph.instagram.com).
 * Every call has its own timeout; errors become `InstagramApiError` with Meta's
 * numeric code so callers can map them to friendly messages. The access token
 * travels as a query parameter (as Meta documents) and is never logged.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 */

/** Latest Graph API version named in Meta's Instagram docs (checked 2026-11-24). */
export const GRAPH_VERSION = "v27.0";

const HOST = "graph.instagram.com";
const BASE = `https://${HOST}`;
const TIMEOUT_MS = 8000;

export class InstagramApiError extends Error {
  constructor(
    /** Meta error code (190 token, 4/17/32/613 rate limit, 10/200 permission…); 0 for network/timeouts */
    readonly code: number,
    readonly subcode: number | null,
    message: string,
    readonly kind: "api" | "timeout" | "network" = "api",
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

interface GraphErrorBody {
  error?: { message?: unknown; code?: unknown; error_subcode?: unknown; type?: unknown };
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002]);

export const isTokenError = (e: unknown): boolean => e instanceof InstagramApiError && e.code === 190;
export const isRateLimitError = (e: unknown): boolean => e instanceof InstagramApiError && RATE_LIMIT_CODES.has(e.code);
/** Missing permission/scope (e.g. a token without instagram_business_manage_insights). */
export const isPermissionError = (e: unknown): boolean =>
  e instanceof InstagramApiError && (e.code === 10 || (e.code >= 200 && e.code < 300));

/** Plain-English message for the admin. Never includes Meta's raw text (which can echo request details). */
export function friendlyInstagramError(e: unknown): string {
  if (!(e instanceof InstagramApiError)) return "Something went wrong talking to Instagram. Please try again.";
  if (e.kind === "timeout") return "Instagram took too long to answer. Please try again in a minute.";
  if (e.kind === "network") return "Couldn't reach Instagram. Check the connection and try again.";
  if (isTokenError(e)) {
    return "Instagram says this token has expired or was revoked. Generate a new token in the Meta app dashboard and connect again.";
  }
  if (isRateLimitError(e)) return "Instagram's rate limit was reached. Wait an hour or so, then fetch again.";
  if (isPermissionError(e)) {
    return "This token doesn't have the permissions needed. Generate a new token with instagram_business_basic and instagram_business_manage_insights.";
  }
  return `Instagram returned an error (code ${e.code}). Please try again later.`;
}

/** Server log line with codes only; the token is redacted if Meta ever echoes it. */
export function logInstagramError(context: string, e: unknown, token?: string): void {
  if (e instanceof InstagramApiError) {
    const msg = token ? e.message.split(token).join("[token]") : e.message;
    console.error(`[instagram] ${context} failed:`, e.kind, e.code, e.subcode ?? "", msg.slice(0, 200));
  } else {
    console.error(`[instagram] ${context} failed:`, e instanceof Error ? e.name : typeof e);
  }
}

function toNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function request<T>(url: URL): Promise<T> {
  if (url.protocol !== "https:" || url.hostname !== HOST) {
    // paging.next comes from the response body; only ever follow it back to Instagram.
    throw new InstagramApiError(0, null, "Refusing to call a non-Instagram URL", "network");
  }
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const timeout = name === "TimeoutError" || name === "AbortError";
    throw new InstagramApiError(0, null, timeout ? "Request timed out" : "Network error", timeout ? "timeout" : "network");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through: non-JSON bodies are treated as errors below
  }

  const error = (body as GraphErrorBody | null)?.error;
  if (!res.ok || error) {
    throw new InstagramApiError(
      toNumber(error?.code) ?? res.status,
      toNumber(error?.error_subcode),
      typeof error?.message === "string" ? error.message : `HTTP ${res.status}`,
    );
  }
  return body as T;
}

/** GET https://graph.instagram.com/{version}/{path}?…&access_token=… */
export function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${BASE}/${GRAPH_VERSION}/${path.replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  return request<T>(url);
}

/** Follows a `paging.next` URL (it already carries the token and cursor). */
export function graphGetUrl<T>(next: string): Promise<T> {
  let url: URL;
  try {
    url = new URL(next);
  } catch {
    return Promise.reject(new InstagramApiError(0, null, "Bad paging URL", "network"));
  }
  return request<T>(url);
}

/* ---------------------------------------------------------------- endpoints */

export interface InstagramProfile {
  userId: string;
  username: string;
  followers: number;
  posts: number;
}

/** GET /me?fields=user_id,username,followers_count,media_count */
export async function getProfile(token: string): Promise<InstagramProfile> {
  const me = await graphGet<{
    id?: unknown;
    user_id?: unknown;
    username?: unknown;
    followers_count?: unknown;
    media_count?: unknown;
  }>("me", { fields: "user_id,username,followers_count,media_count" }, token);

  const userId = typeof me.user_id === "string" || typeof me.user_id === "number" ? String(me.user_id) : typeof me.id === "string" ? me.id : "";
  const username = typeof me.username === "string" ? me.username : "";
  if (!userId || !username) throw new InstagramApiError(0, null, "Profile response missing id/username");
  return {
    userId,
    username,
    followers: toNumber(me.followers_count) ?? 0,
    posts: toNumber(me.media_count) ?? 0,
  };
}

export interface RefreshedToken {
  accessToken: string;
  expiresAt: string;
}

/**
 * GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token
 * Works on an unexpired long-lived token at least 24 hours old; the new one is valid 60 days.
 * Not versioned in Meta's docs.
 */
export async function refreshLongLivedToken(token: string): Promise<RefreshedToken> {
  const url = new URL(`${BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const res = await request<{ access_token?: unknown; expires_in?: unknown }>(url);
  if (typeof res.access_token !== "string" || res.access_token === "") {
    throw new InstagramApiError(0, null, "Refresh response missing access_token");
  }
  const seconds = toNumber(res.expires_in) ?? 60 * 24 * 60 * 60;
  return { accessToken: res.access_token, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() };
}
