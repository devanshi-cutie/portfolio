"use client";

import type { ReactNode } from "react";
import { Tooltip as RadixTooltip } from "radix-ui";
import { useAdminPortalContainer } from "./portal";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={300}>{children}</RadixTooltip.Provider>;
}

/** Wraps `children` (which must accept a ref). Disabled buttons should be wrapped in a focusable span. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const container = useAdminPortalContainer();
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal container={container}>
        <RadixTooltip.Content
          sideOffset={6}
          className="adm-tooltip z-[70] max-w-64 rounded-md bg-(--a-ink) px-2.5 py-1.5 text-xs leading-snug text-(--a-surface) shadow-md"
        >
          {content}
          <RadixTooltip.Arrow className="fill-(--a-ink)" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
