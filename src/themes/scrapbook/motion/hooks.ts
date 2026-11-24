"use client";

import { useSyncExternalStore } from "react";

function subscribeQuery(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

/** SSR-safe media query; returns `fallback` on the server. */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    subscribeQuery(query),
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

/** Mouse/trackpad users get hover previews and drag; touch users get tap/scroll. */
export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");

/** Respect Data Saver: no autoplay previews. */
export function prefersSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(c?.saveData);
}
