"use client";

import { useEffect, useState } from "react";

/**
 * "Good morning / afternoon / evening" in the viewer's own timezone. The server
 * renders the neutral "Welcome back"; the time-of-day line swaps in after
 * hydration, so there is no mismatch and nothing depends on server time.
 */
export function TimeGreeting({ fallback = "Welcome back" }: { fallback?: string }) {
  const [text, setText] = useState(fallback);
  useEffect(() => {
    const h = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client clock is only known after mount
    setText(h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return <>{text}</>;
}
