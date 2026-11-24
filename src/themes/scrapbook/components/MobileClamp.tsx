"use client";

/**
 * Phones only: clamps long content to `collapsedHeight` with a soft fade and a
 * "Show all" toggle. From md up the content is always fully shown. Content
 * stays in the DOM (and in the accessibility tree) either way; the toggle uses
 * aria-expanded.
 */
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

export function MobileClamp({
  children,
  moreLabel,
  lessLabel = "Show less",
  collapsedClassName = "max-md:max-h-[15rem]",
  fadeFrom = "from-(--cream)",
  className,
}: {
  children: ReactNode;
  moreLabel: string;
  lessLabel?: string;
  /** max-height while collapsed on phones, as a literal `max-md:max-h-[…]` class */
  collapsedClassName?: string;
  /** gradient start colour matching the background */
  fadeFrom?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <div id={id} className={cn("relative", !open && "max-md:overflow-hidden", !open && collapsedClassName)}>
        {children}
        {!open ? (
          <div
            aria-hidden
            className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent md:hidden", fadeFrom)}
          />
        ) : null}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--ink-soft) px-4 text-sm font-semibold text-(--ink) transition-[background-color,transform] duration-150 active:scale-[0.97] md:hidden"
      >
        {open ? lessLabel : moreLabel}
        <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
    </div>
  );
}
