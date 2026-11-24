import "server-only";

import type { z } from "zod";
import { fail, type ActionResult } from "@/core/actions/result";

export const PREVIEW_ERROR = "Supabase is not configured";

interface DbError {
  message: string;
  code?: string;
  details?: string | null;
}

/** Turns a zod failure into an `ActionResult` with per-field messages. */
export function invalid(error: z.ZodError, message = "Please check the highlighted fields"): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(message, fieldErrors);
}

/**
 * Logs a database error server-side and returns a safe message.
 * Unique violations get a friendly message (optionally tied to a field).
 */
export function dbFail(error: DbError, context: string, uniqueField?: string): ActionResult<never> {
  if (error.code === "23505") {
    const msg = uniqueField ? `That ${uniqueField} is already in use` : "That already exists";
    return fail(msg, uniqueField ? { [uniqueField]: [msg] } : undefined);
  }
  if (error.code === "23503") {
    return fail("A linked item no longer exists — refresh and try again");
  }
  if (error.code === "42501") {
    return fail("You do not have permission to do that");
  }
  console.error(`[action] ${context} failed:`, error.code ?? "", error.message);
  return fail(`Could not ${context}. Please try again.`);
}
