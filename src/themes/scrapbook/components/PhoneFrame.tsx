import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/** Rounded device frame with a hint of the Instagram reel UI. Presentational. */
export function PhoneFrame({
  children,
  handle,
  className,
  bar = true,
}: {
  children: ReactNode;
  handle?: string;
  className?: string;
  bar?: boolean;
}) {
  return (
    <div className={cn("sb-phone", className)}>
      <div className="sb-phone-screen">
        <span className="sb-phone-notch" aria-hidden />
        {children}
        {bar ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex items-end justify-between bg-[linear-gradient(to_top,rgb(31_12_19/0.7),transparent)] px-3 pb-3 pt-10 text-(--cream)"
          >
            {handle ? <span className="truncate text-[0.7rem] font-semibold">@{handle}</span> : <span />}
            <span className="flex shrink-0 items-center gap-2 opacity-90">
              <Heart className="size-3.5" strokeWidth={2} />
              <MessageCircle className="size-3.5" strokeWidth={2} />
              <Send className="size-3.5" strokeWidth={2} />
              <Bookmark className="size-3.5" strokeWidth={2} />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
