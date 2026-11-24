"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackAdminView } from "@/core/actions/counters";

/**
 * Header pill for the creator's admin counter (admin.counter in the creator
 * package). Every admin page open or refresh reports one view to the server,
 * which adds `perView` and returns the new total; sign-ins add `perLogin`.
 */
export function LikeCounter({ label }: { label: string }) {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);
  const [bump, setBump] = useState(0);
  // React re-runs effects in development; count each page once.
  const tracked = useRef<string | null>(null);

  useEffect(() => {
    if (tracked.current === pathname) return;
    tracked.current = pathname;
    let alive = true;
    trackAdminView()
      .then((total) => {
        if (!alive || total === null) return;
        setCount(total);
        setBump((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (count === null) return null;
  const formatted = count.toLocaleString("en-IN");

  return (
    <div
      role="status"
      aria-live="polite"
      title={`${formatted} ${label}`}
      className="flex min-h-9 items-center gap-1.5 rounded-full border border-(--a-line) bg-(--a-blush)/50 px-3 py-1 text-xs font-semibold text-(--a-ink)"
    >
      <span key={bump} aria-hidden className="adm-count-pop inline-block">
        💘
      </span>
      <span key={`n-${bump}`} className="adm-count-pop inline-block tabular-nums">
        {formatted}
      </span>
      <span className="hidden max-w-[22rem] truncate font-medium text-(--a-ink-soft) md:inline">{label}</span>
      <span className="sr-only md:hidden">{label}</span>
    </div>
  );
}
