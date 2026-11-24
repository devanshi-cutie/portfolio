import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { isAdminPasswordConfigured, sessionCookieName } from "./mode";

/**
 * Stateless admin session: `<expiresAtMs>.<nonce>.<sig>` in an httpOnly cookie,
 * where sig = base64url(HMAC-SHA256(key, "<expiresAtMs>.<nonce>")).
 *
 * The key is derived from ADMIN_PASSWORD (+ SUPABASE_SERVICE_ROLE_KEY when set),
 * salted with ADMIN_SESSION_SECRET when set. So changing the password (or the
 * secret) invalidates every session. With no ADMIN_PASSWORD nothing verifies.
 */

export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

function signingKey(): Buffer | null {
  if (!isAdminPasswordConfigured()) return null;
  const password = (process.env.ADMIN_PASSWORD ?? "").trim();
  const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return createHmac("sha256", secret || "creator-portfolio/admin-session/v1")
    .update(`${password}\0${serviceKey}`)
    .digest();
}

const sign = (key: Buffer, payload: string): string => createHmac("sha256", key).update(payload).digest("base64url");

/** A fresh signed token valid for `maxAgeS` seconds from `now`. Throws if no password is configured. */
export function createSessionToken(now = Date.now(), maxAgeS = SESSION_MAX_AGE_S): string {
  const key = signingKey();
  if (!key) throw new Error("Admin password is not configured");
  const payload = `${now + maxAgeS * 1000}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${sign(key, payload)}`;
}

/** True for a well-formed, correctly signed, unexpired token. Never throws. */
export function verifySession(token: string | null | undefined, now = Date.now()): boolean {
  if (typeof token !== "string" || token.length > 200) return false;
  const key = signingKey();
  if (!key) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (!/^\d{1,16}$/.test(exp) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !/^[A-Za-z0-9_-]+$/.test(sig)) return false;
  if (Number(exp) <= now) return false;

  const expected = Buffer.from(sign(key, `${exp}.${nonce}`));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Constant-time password check (SHA-256 digests, so lengths never leak). */
export function checkAdminPassword(input: string): boolean {
  if (!isAdminPasswordConfigured()) return false;
  const expected = createHash("sha256").update((process.env.ADMIN_PASSWORD ?? "").trim()).digest();
  const given = createHash("sha256").update(input).digest();
  return timingSafeEqual(given, expected);
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  // "/" so /api/cloudinary/sign receives it too.
  path: "/",
});

/** Sets a new session cookie. Server Actions / Route Handlers only. */
export async function createSession(): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(), createSessionToken(), { ...cookieOptions(), maxAge: SESSION_MAX_AGE_S });
}

/** True when the request carries a valid session cookie. */
export async function readSession(): Promise<boolean> {
  const store = await cookies();
  // explicit request-time marker before reading the clock (cacheComponents prerender check)
  await connection();
  return verifySession(store.get(sessionCookieName())?.value, Date.now());
}

/** Expires the session cookie. Server Actions / Route Handlers only. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(), "", { ...cookieOptions(), maxAge: 0 });
}
