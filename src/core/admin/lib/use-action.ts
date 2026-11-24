"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/core/actions/result";

const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

export interface RunOptions {
  /** toast shown on success; omit for a silent success */
  success?: string;
  /** called before the request (apply an optimistic change) */
  optimistic?: () => void;
  /** called when the request fails (undo the optimistic change) */
  rollback?: () => void;
  /** refresh server components after success (default true) */
  refresh?: boolean;
}

/**
 * Calls a server action, toasts the outcome, rolls back optimistic UI on failure
 * and refreshes the route on success so server props catch up.
 */
export async function callAction<T>(
  fn: () => Promise<ActionResult<T>>,
  opts: Pick<RunOptions, "success" | "optimistic" | "rollback"> = {},
): Promise<ActionResult<T>> {
  opts.optimistic?.();
  let result: ActionResult<T>;
  try {
    result = await fn();
  } catch (error) {
    // next/navigation redirects are thrown as errors with a digest; let them through
    if (error && typeof error === "object" && "digest" in error) throw error;
    result = { ok: false, error: NETWORK_ERROR };
  }
  if (result.ok) {
    if (opts.success) toast.success(opts.success);
  } else {
    opts.rollback?.();
    toast.error(result.error);
  }
  return result;
}

export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = useCallback(
    async <T>(
      fn: () => Promise<ActionResult<T>>,
      opts: RunOptions & { key?: string } = {},
    ): Promise<ActionResult<T>> => {
      setBusyKey(opts.key ?? "default");
      try {
        const result = await callAction(fn, opts);
        if (result.ok && opts.refresh !== false) {
          startTransition(() => router.refresh());
        }
        return result;
      } finally {
        setBusyKey(null);
      }
    },
    [router],
  );

  return { run, refreshing: pending, busyKey, isBusy: (key = "default") => busyKey === key };
}
