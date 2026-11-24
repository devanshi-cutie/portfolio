import type { ReactNode } from "react";
import type { SectionConfig } from "@/core/types/content";
import { cn } from "../lib/cn";
import { BlurWords } from "../motion/BlurWords";

/**
 * Script + condensed caps lockup ("Some of my / FAVOURITE WORK"), built from
 * any admin-edited title: the last words go big in caps, the lead-in in script.
 */
export function splitTitle(title: string): { lead: string; main: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return { lead: "", main: words.join(" ") };
  const tail = words.length >= 4 ? 2 : 1;
  return { lead: words.slice(0, -tail).join(" "), main: words.slice(-tail).join(" ") };
}

export function Tape({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "sb-tape inline-block -rotate-2 whitespace-nowrap px-4 py-1 text-[0.8125rem] font-semibold text-(--ink)",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  section,
  id,
  eyebrow = false,
  align = "left",
  tone = "light",
  size = "lg",
  as: Heading = "h2",
  className,
}: {
  section: Pick<SectionConfig, "title" | "eyebrow" | "subtitle">;
  /** id for the heading, referenced by the section's aria-labelledby */
  id: string;
  /** show the eyebrow as a tape label (used on a few sections only) */
  eyebrow?: boolean;
  align?: "left" | "center";
  tone?: "light" | "dark";
  size?: "lg" | "md";
  /** heading level; a collection page uses h1 */
  as?: "h1" | "h2";
  className?: string;
}) {
  const { lead, main } = splitTitle(section.title);
  const centered = align === "center";
  return (
    <header className={cn("relative", centered && "mx-auto text-center", className)}>
      {eyebrow && section.eyebrow ? <Tape className="mb-5">{section.eyebrow}</Tape> : null}
      <Heading id={id} className={cn("flex flex-col", centered ? "items-center" : "items-start")}>
        {lead ? (
          <span
            className={cn(
              "sb-accent mb-1 block text-[clamp(1.6rem,3.4vw,2.5rem)]",
              tone === "dark" ? "text-(--blush)" : "text-(--rose-deep)",
            )}
          >
            {lead}
          </span>
        ) : null}
        <BlurWords
          text={main}
          className={cn(
            "sb-display block text-balance",
            size === "lg" ? "text-[clamp(2.75rem,7vw,5.75rem)]" : "text-[clamp(2.4rem,5vw,4rem)]",
            tone === "dark" ? "text-(--cream)" : "text-(--ink)",
          )}
        />
      </Heading>
      {section.subtitle ? (
        <p
          className={cn(
            "mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed",
            centered && "mx-auto",
            tone === "dark" ? "text-(--cream)" : "text-(--ink-soft)",
          )}
        >
          {section.subtitle}
        </p>
      ) : null}
    </header>
  );
}
