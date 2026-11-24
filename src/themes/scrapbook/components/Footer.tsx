import { ArrowUpRight } from "lucide-react";
import { SITE_CREDIT } from "@/core/lib/credit";
import type { SiteContent } from "@/core/types/content";
import { instagramUrl } from "../lib/media";
import { Heart } from "./Doodles";

/** Peak-end: a lace-edged rose page with a big italic "Thank you". */
export function Footer({ content }: { content: SiteContent }) {
  const { identity } = content.settings;
  // social profiles only; website / portfolio links (e.g. the media kit) live in Contact and Services
  const socials = content.settings.socials.filter((s) => s.url && s.platform !== "website");
  const ig = instagramUrl(content);
  return (
    <footer className="sb-on-dark sb-lace relative mt-10 bg-(--rose-deep) px-(--gutter) pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-20 text-(--cream) md:pt-24">
      <div className="mx-auto max-w-[1320px]">
        <div className="relative flex flex-col items-center text-center">
          <Heart className="absolute -top-4 right-[18%] hidden size-10 -rotate-12 text-(--blush) md:block" />
          <p className="sb-accent text-[clamp(3.75rem,16vw,11rem)] leading-[1.05] text-(--cream)">Thank you</p>
          <a
            href={ig}
            target="_blank"
            rel="noopener noreferrer"
            className="sb-display mt-3 inline-flex min-h-11 items-center gap-2 text-[clamp(1.4rem,3vw,2rem)] hover:text-(--blush)"
          >
            @{identity.handle}
            <ArrowUpRight className="size-5" aria-hidden />
          </a>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-(--cream)/20 pt-8 text-sm md:flex-row md:items-center md:justify-between">
          <p className="text-(--cream)">
            {identity.name}. {identity.role}, {identity.location}.
          </p>
          {socials.length ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {socials.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center font-semibold underline decoration-(--blush)/60 underline-offset-4 hover:decoration-(--blush)"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="mt-6 text-xs text-(--cream)">
          Built by{" "}
          <a
            href={SITE_CREDIT.url}
            target="_blank"
            rel="noopener"
            className="font-semibold underline decoration-(--blush)/60 underline-offset-2 hover:decoration-(--blush)"
          >
            {SITE_CREDIT.label}
          </a>
        </p>
      </div>
    </footer>
  );
}
