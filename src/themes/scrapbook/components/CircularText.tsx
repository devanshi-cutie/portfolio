/*
 * Rotating circular badge ("UGC CREATOR • JAIPUR •"), the React Bits
 * "CircularText" idea (reactbits.dev, David Haz, MIT) done as an SVG textPath
 * with a CSS spin, so it needs no client JavaScript. Linear spin is the
 * sanctioned spinner case; stops under reduced motion.
 */
import { cn } from "../lib/cn";

export function CircularText({ text, className }: { text: string; className?: string }) {
  const id = `ct-${text.replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase()}`;
  return (
    <div aria-hidden className={cn("relative size-32", className)}>
      <svg viewBox="0 0 120 120" className="sb-spin size-full">
        <defs>
          <path id={id} d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
        </defs>
        <text className="fill-current text-[10.5px] font-semibold uppercase" style={{ letterSpacing: "0.32em" }}>
          <textPath href={`#${id}`} textLength="286">
            {text}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
