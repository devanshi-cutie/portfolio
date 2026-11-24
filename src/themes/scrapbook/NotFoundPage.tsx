import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "./components/Button";
import { Squiggle } from "./components/Doodles";

/** In-site 404 body (rendered inside SiteShell). */
export function NotFoundPage() {
  return (
    <section
      aria-labelledby="nf-title"
      className="flex min-h-[80dvh] items-center px-(--gutter) pb-20 pt-[calc(var(--nav-h)+3rem)]"
    >
      <div className="mx-auto w-full max-w-[1320px]">
        <h1 id="nf-title" className="flex flex-col">
          <span className="sb-accent text-[clamp(2rem,5vw,3.5rem)] leading-none text-(--rose-deep)">Oops, this page</span>
          <span className="sb-display text-[clamp(3.25rem,10vw,7.5rem)]">wasn&apos;t filmed</span>
        </h1>
        <Squiggle className="mt-4 h-4 w-40 text-(--blush)" />
        <p className="mt-6 max-w-[40ch] text-lg text-(--ink-soft)">
          The link may be old, or the collection was renamed. Everything else is one tap away.
        </p>
        <ButtonLink href="/" className="mt-9">
          <ArrowLeft className="size-4" aria-hidden />
          Back to the portfolio
        </ButtonLink>
      </div>
    </section>
  );
}
