import "server-only";

import { z } from "zod";
import { requireAdmin } from "@/core/auth/guard";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { InstagramSnapshot, InstagramStatus } from "./types";

/*
 * The stored Instagram connection: row key "instagram" in public.integrations
 * (service role only — RLS on, no policies). Holds the long-lived token, so
 * nothing in this file may be imported by client code, and `getInstagramStatus()`
 * is the only shape that leaves the server.
 *
 * INSTAGRAM_ACCESS_TOKEN is an optional fallback / first token: used when no
 * row exists. The first successful fetch stores it (with its refreshed
 * successor) in the table, and from then on the row wins.
 */

const KEY = "instagram";

const snapshotSchema = z.object({
  username: z.string(),
  followers: z.number(),
  posts: z.number(),
  reels: z.number(),
  reelViews: z.number().nullable(),
  topReelViews: z.number().nullable(),
  topReelPermalink: z.string().nullable(),
  reelsWithViews: z.number().catch(0),
  mediaScanned: z.number().catch(0),
  fetchedAt: z.string(),
  warnings: z.array(z.string()).catch([]),
}) satisfies z.ZodType<InstagramSnapshot>;

const storedSchema = z.object({
  accessToken: z.string().min(1),
  userId: z.string(),
  username: z.string(),
  /** when this token was issued or last refreshed (refresh needs it to be 24h+ old) */
  tokenUpdatedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  lastSnapshot: snapshotSchema.optional().catch(undefined),
});

export type StoredInstagramConnection = z.infer<typeof storedSchema>;

export interface InstagramConnection extends StoredInstagramConnection {
  source: "admin" | "env";
}

const envToken = (): string => (process.env.INSTAGRAM_ACCESS_TOKEN ?? "").trim();

/** The stored row, else the env token, else null. Throws only on a database error. */
export async function getConnection(): Promise<InstagramConnection | null> {
  if (isSupabaseServiceConfigured()) {
    const { data, error } = await createSupabaseServiceClient()
      .from("integrations")
      .select("data")
      .eq("key", KEY)
      .maybeSingle();
    if (error) {
      console.error("[instagram] read connection failed:", error.code ?? "", error.message);
      throw new Error("Could not load the Instagram connection");
    }
    const parsed = storedSchema.safeParse(data?.data);
    if (parsed.success) return { ...parsed.data, source: "admin" };
    if (data?.data && !parsed.success) console.error("[instagram] stored connection has an unexpected shape; ignoring it");
  }
  const token = envToken();
  if (!token) return null;
  return { accessToken: token, userId: "", username: "", tokenUpdatedAt: null, expiresAt: null, source: "env" };
}

/** Upserts the row. Callers must have run requireAdmin(). */
export async function saveConnection(conn: StoredInstagramConnection): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseServiceConfigured()) return { ok: false, error: "Supabase is not configured" };
  const data = storedSchema.parse(conn);
  const { error } = await createSupabaseServiceClient()
    .from("integrations")
    .upsert({ key: KEY, data, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("[instagram] save connection failed:", error.code ?? "", error.message);
    return { ok: false, error: "Could not save the Instagram connection. Please try again." };
  }
  return { ok: true };
}

/** Deletes the stored row. An INSTAGRAM_ACCESS_TOKEN env var, if set, still applies afterwards. */
export async function deleteConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseServiceConfigured()) return { ok: false, error: "Supabase is not configured" };
  const { error } = await createSupabaseServiceClient().from("integrations").delete().eq("key", KEY);
  if (error) {
    console.error("[instagram] delete connection failed:", error.code ?? "", error.message);
    return { ok: false, error: "Could not disconnect Instagram. Please try again." };
  }
  return { ok: true };
}

/** The admin page's view of the connection — no token. */
export async function getInstagramStatus(): Promise<InstagramStatus> {
  await requireAdmin();
  const storageReady = isSupabaseServiceConfigured();
  let conn: InstagramConnection | null = null;
  try {
    conn = await getConnection();
  } catch {
    // Missing table (migration not applied yet) or a transient error: show "not connected".
    conn = envToken()
      ? { accessToken: "", userId: "", username: "", tokenUpdatedAt: null, expiresAt: null, source: "env" }
      : null;
  }
  return {
    storageReady,
    connected: conn !== null,
    source: conn?.source ?? null,
    username: conn?.username || null,
    expiresAt: conn?.expiresAt ?? null,
    tokenUpdatedAt: conn?.tokenUpdatedAt ?? null,
    lastSnapshot: conn?.lastSnapshot ?? null,
  };
}
