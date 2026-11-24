"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminPasswordConfigured } from "@/core/auth/mode";
import { adminCounter, loginConsent } from "@/core/config/admin-extras";
import { incrementCounter } from "@/core/data/counters";
import { checkAdminPassword, clearSession, createSession } from "@/core/auth/session";
import { fail, type ActionResult } from "./result";

/*
 * Single-password admin sign-in (ADMIN_PASSWORD). These deliberately do not call
 * `requireAdmin()` — there is no session yet when signing in. Every other admin
 * action and page does.
 */

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const FAILURE_DELAY_MS = 600;
const MAX_PASSWORD_LENGTH = 1024;

/**
 * Best-effort brute-force guard: per-IP failure timestamps, per server instance
 * (serverless instances do not share it). 5 failures in 15 minutes lock the IP
 * out until the oldest failure ages out of the window.
 */
const failures = new Map<string, number[]>();
/** All failures across IPs, so rotating addresses can't make guessing cheap. */
let globalFailures: number[] = [];
const GLOBAL_SLOWDOWN_AT = 50; // per window, across all IPs
const MAX_TRACKED_IPS = 5_000;

function recentFailures(ip: string, now: number): number[] {
  const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(ip, list);
  else failures.delete(ip);
  return list;
}

function recentGlobalFailures(now: number): number {
  globalFailures = globalFailures.filter((t) => now - t < WINDOW_MS);
  return globalFailures.length;
}

function recordFailure(ip: string, now: number): void {
  // Evict the oldest entries (Map keeps insertion order) instead of clearing,
  // so a spray from many addresses can't wipe existing lockouts.
  while (failures.size >= MAX_TRACKED_IPS) {
    const oldest = failures.keys().next().value;
    if (oldest === undefined) break;
    failures.delete(oldest);
  }
  const list = [...recentFailures(ip, now), now];
  failures.delete(ip);
  failures.set(ip, list);
  globalFailures.push(now);
}

/** IPv6 clients are keyed by their /64 prefix (one subscriber usually owns the whole block). */
function rateKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  return ip.split(":").slice(0, 4).join(":") + "::/64";
}

async function clientIp(): Promise<string> {
  const h = await headers();
  // On Vercel, x-real-ip / the first x-forwarded-for hop are set by the platform.
  const raw = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  return rateKey(raw.trim().toLowerCase() || "unknown");
}

/** Only same-site admin paths, e.g. "/admin/media?kind=reel". */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.length > 512) return "/admin";
  if (!/^\/admin(?:[/?#]|$)/.test(value) || value.includes("//") || value.includes("\\") || value.includes("..")) {
    return "/admin";
  }
  if (/^\/admin\/login(?:[/?#]|$)/.test(value)) return "/admin";
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reads only the `password` field (and an optional `next` admin path). Redirects on success. */
export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!isAdminPasswordConfigured()) return fail("Admin password is not configured");

  const ip = await clientIp();
  const now = Date.now();
  if (recentFailures(ip, now).length >= MAX_FAILURES) {
    return fail("Too many attempts. Please wait 15 minutes and try again.");
  }

  // Creator-specific consent checkbox (src/creators/<id> → admin.loginConsent): enforced here,
  // not just in the browser. Checked before the password, and not counted as a failed attempt.
  const consent = loginConsent();
  if (consent && formData.get("consent") !== "yes") {
    return fail(consent.error, { consent: [consent.error] });
  }

  const raw = formData.get("password");
  const password = typeof raw === "string" ? raw : "";
  if (password === "" || password.length > MAX_PASSWORD_LENGTH || !checkAdminPassword(password)) {
    recordFailure(ip, now);
    // Under a broad attack, every failed attempt gets much slower.
    await sleep(recentGlobalFailures(now) >= GLOBAL_SLOWDOWN_AT ? FAILURE_DELAY_MS * 5 : FAILURE_DELAY_MS);
    return fail("Incorrect password", { password: ["Incorrect password"] });
  }

  failures.delete(ip);
  await createSession();
  const counter = adminCounter();
  if (counter) await incrementCounter(counter.key, counter.perLogin);
  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/admin/login");
}
