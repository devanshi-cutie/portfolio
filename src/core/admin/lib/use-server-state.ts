"use client";

import { useState } from "react";

/**
 * Local, optimistically editable copy of a server-provided value.
 * When the server sends a new value (after router.refresh / revalidation),
 * the local copy resets to it. Uses React's "adjust state during render" pattern.
 */
export function useServerState<T>(serverValue: T) {
  const [state, setState] = useState(serverValue);
  const [seen, setSeen] = useState(serverValue);
  if (seen !== serverValue) {
    setSeen(serverValue);
    setState(serverValue);
  }
  return [state, setState] as const;
}
