"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime } from "../lib/format";

const noopSubscribe = () => () => {};

/**
 * Server and browser time zones differ. The server/hydration pass renders a stable UTC date,
 * then the browser switches to the viewer's local time.
 */
export function LocalDateTime({ iso, className }: { iso: string; className?: string }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return (
    <time dateTime={iso} className={className}>
      {isClient ? formatDateTime(iso) : formatDateTime(iso, "UTC")}
    </time>
  );
}
