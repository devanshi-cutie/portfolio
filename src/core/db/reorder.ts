import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SortableTable = "media" | "collections" | "brands" | "testimonials";

/**
 * Reorders `ids` among themselves: they take the ascending set of their own
 * current `sort_order` values, so reordering a filtered view never moves rows
 * outside it. Ties are spread into a strictly increasing sequence first.
 * Only rows whose position changed are written.
 *
 * The writes are not atomic: `wrote` counts the rows that did change, so a
 * caller must invalidate the content cache whenever `wrote > 0`, even if
 * `error` is set, or the public order would stay stale.
 */
export async function reorderRows(
  supabase: SupabaseClient,
  table: SortableTable,
  ids: string[],
): Promise<{ error: { message: string; code?: string } | null; wrote: number }> {
  const { data, error } = await supabase.from(table).select("id, sort_order").in("id", ids);
  if (error) return { error, wrote: 0 };

  const rows = (data ?? []) as { id: string; sort_order: number }[];
  if (rows.length !== ids.length) return { error: { message: "Some items no longer exist", code: "NOT_FOUND" }, wrote: 0 };

  const current = new Map(rows.map((r) => [r.id, r.sort_order]));
  const slots = rows.map((r) => r.sort_order).sort((a, b) => a - b);
  for (let i = 1; i < slots.length; i++) {
    if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 1;
  }

  const changes = ids
    .map((id, i) => ({ id, sort_order: slots[i] }))
    .filter(({ id, sort_order }) => current.get(id) !== sort_order);

  const results = await Promise.all(
    changes.map(({ id, sort_order }) => supabase.from(table).update({ sort_order }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error ?? null, wrote: results.filter((r) => !r.error).length };
}

/** Next `sort_order` for a new row (max + 1, or 0 for an empty table). */
export async function nextSortOrder(supabase: SupabaseClient, table: SortableTable): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const max = (data as { sort_order: number } | null)?.sort_order;
  return typeof max === "number" ? max + 1 : 0;
}
