"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Radix portals default to <body>, outside the themed #adm-root, where the
 * brand fonts and --a-* tokens would be lost. Portal into the root instead.
 */
export function useAdminPortalContainer(): HTMLElement | undefined {
  const node = useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById("adm-root"),
    () => null,
  );
  return node ?? undefined;
}
