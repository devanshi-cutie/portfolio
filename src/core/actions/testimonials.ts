"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { updateTag } from "next/cache";
import { requireAdmin } from "@/core/auth/guard";
import { TESTIMONIAL_COLUMNS, mapTestimonial, testimonialInputToRow, type TestimonialRow } from "@/core/data/mappers";
import { CONTENT_TAG } from "@/core/data/tags";
import { PREVIEW_ERROR, dbFail, invalid } from "@/core/db/errors";
import { nextSortOrder, reorderRows } from "@/core/db/reorder";
import { idListSchema, idSchema } from "@/core/schemas/common";
import { testimonialInputSchema } from "@/core/schemas/testimonial";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { TestimonialInput } from "@/core/types/admin";
import type { Testimonial } from "@/core/types/content";
import { fail, ok, type ActionResult } from "./result";

/**
 * requireAdmin() first (redirects without a valid session), then the service-role
 * client — or null when Supabase is not configured (read-only preview).
 */
async function adminClient(): Promise<SupabaseClient | null> {
  await requireAdmin();
  return isSupabaseServiceConfigured() ? createSupabaseServiceClient() : null;
}

export async function createTestimonial(input: TestimonialInput): Promise<ActionResult<Testimonial>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const parsed = testimonialInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const row = { ...testimonialInputToRow(parsed.data), sort_order: await nextSortOrder(supabase, "testimonials") };
  const { data, error } = await supabase.from("testimonials").insert(row).select(TESTIMONIAL_COLUMNS).single();
  if (error) return dbFail(error, "create the testimonial");

  updateTag(CONTENT_TAG);
  return ok(mapTestimonial(data as TestimonialRow));
}

export async function updateTestimonial(
  id: string,
  patch: Partial<TestimonialInput>,
): Promise<ActionResult<Testimonial>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  if (!idSchema.safeParse(id).success) return fail("Testimonial not found");
  const parsed = testimonialInputSchema.partial().safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);

  const changes = testimonialInputToRow(parsed.data);
  const query =
    Object.keys(changes).length === 0
      ? supabase.from("testimonials").select(TESTIMONIAL_COLUMNS).eq("id", id).maybeSingle()
      : supabase.from("testimonials").update(changes).eq("id", id).select(TESTIMONIAL_COLUMNS).maybeSingle();
  const { data, error } = await query;
  if (error) return dbFail(error, "update the testimonial");
  if (!data) return fail("Testimonial not found");

  updateTag(CONTENT_TAG);
  return ok(mapTestimonial(data as TestimonialRow));
}

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Testimonial not found");

  const { data, error } = await supabase.from("testimonials").delete().eq("id", id).select("id");
  if (error) return dbFail(error, "delete the testimonial");
  if (!data?.length) return fail("Testimonial not found");

  updateTag(CONTENT_TAG);
  return ok(undefined);
}

export async function reorderTestimonials(ids: string[]): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const parsed = idListSchema.safeParse(ids);
  if (!parsed.success) return invalid(parsed.error, "Nothing to reorder");

  const { error, wrote } = await reorderRows(supabase, "testimonials", parsed.data);
  // Partial writes still changed the public order: invalidate before reporting an error.
  if (wrote > 0) updateTag(CONTENT_TAG);
  if (error) return error.code === "NOT_FOUND" ? fail(error.message) : dbFail(error, "reorder testimonials");

  return ok(undefined);
}
