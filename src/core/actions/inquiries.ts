"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { recordInteraction } from "@/core/analytics/interactions";
import { requireAdmin } from "@/core/auth/guard";
import { PREVIEW_ERROR, dbFail, invalid } from "@/core/db/errors";
import { idSchema } from "@/core/schemas/common";
import { inquiryInputSchema, inquiryStatusSchema } from "@/core/schemas/inquiry";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { InquiryStatus } from "@/core/types/content";
import { fail, ok, type ActionResult } from "./result";

/* ------------------------------------------------------- public contact form */

const field = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};
const optional = (value: string): string | null => (value.trim() === "" ? null : value);

/**
 * Best-effort per-IP throttle (per server instance; serverless instances do not
 * share it). Keeps a casual script from flooding the inbox.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function throttled(ip: string, now: number): boolean {
  if (recent.size > 5000) recent.clear();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);
  return false;
}

/**
 * Public contact form action (no auth; `requireAdmin()` deliberately not called).
 * Honeypot field `website`: when filled, pretends success and stores nothing.
 * Inserts with the anon client and WITHOUT `.select()` (anon cannot read inquiries).
 */
export async function submitInquiry(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (field(formData, "website").trim() !== "") return ok(undefined);

  if (!isSupabaseServiceConfigured()) {
    return fail("The contact form is not connected yet — please reach out on Instagram for now.");
  }

  const parsed = inquiryInputSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email").trim(),
    company: optional(field(formData, "company")),
    budget: optional(field(formData, "budget")),
    message: field(formData, "message"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  if (throttled(ip, Date.now())) {
    return fail("You've sent a few messages already — please try again in a little while.");
  }

  // Server-side insert with the service role: the anon key has no insert grant,
  // so the throttle and honeypot above can't be bypassed via the REST API.
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("inquiries").insert({ ...parsed.data, status: "new" });
  if (error) {
    console.error("[action] submitInquiry failed:", error.code ?? "", error.message);
    return fail("Something went wrong sending your message. Please try again.");
  }
  // counted after the response; recordInteraction never throws
  after(() => recordInteraction("contact_sent", "form"));
  return ok(undefined);
}

/* ------------------------------------------------------------------ admin */

export async function setInquiryStatus(id: string, status: InquiryStatus): Promise<ActionResult> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);

  if (!idSchema.safeParse(id).success) return fail("Inquiry not found");
  const parsed = inquiryStatusSchema.safeParse(status);
  if (!parsed.success) return invalid(parsed.error, "Unknown status");

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("inquiries").update({ status: parsed.data }).eq("id", id).select("id");
  if (error) return dbFail(error, "update the inquiry");
  if (!data?.length) return fail("Inquiry not found");

  // Inquiries are not part of the cached site content; just refresh the admin view.
  refresh();
  return ok(undefined);
}

export async function deleteInquiry(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Inquiry not found");

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("inquiries").delete().eq("id", id).select("id");
  if (error) return dbFail(error, "delete the inquiry");
  if (!data?.length) return fail("Inquiry not found");

  refresh();
  return ok(undefined);
}
