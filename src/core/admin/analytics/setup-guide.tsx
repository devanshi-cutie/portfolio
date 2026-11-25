import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "../lib/cn";
import { focusRing } from "../ui/button";

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-0.5 rounded font-medium text-(--a-ink) underline underline-offset-2 hover:text-(--a-primary)", focusRing)}
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-(--a-muted) px-1 py-0.5 text-[0.85em] break-all text-(--a-ink)">{children}</code>
);

/**
 * Steps to connect Vercel Web Analytics. Every value goes into Vercel's
 * environment variables; this page never reads or shows them.
 */
export function SetupGuide() {
  const steps: { title: string; body: ReactNode }[] = [
    {
      title: "Turn on Web Analytics",
      body: (
        <>
          In <A href="https://vercel.com/dashboard">Vercel</A> open this project → <em>Analytics</em> →{" "}
          <em>Enable Web Analytics</em>. Visits start counting from the next deploy.
        </>
      ),
    },
    {
      title: "Create an access token",
      body: (
        <>
          At <A href="https://vercel.com/account/tokens">vercel.com/account/tokens</A> choose <em>Create token</em>. Set the
          scope to this project only and pick an expiry date. Copy the token; Vercel shows it once.
        </>
      ),
    },
    {
      title: "Add the environment variables",
      body: (
        <>
          In Vercel → your project → <em>Settings → Environment Variables</em>, add these for <em>Production</em>:
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
            <li>
              <Code>VERCEL_ANALYTICS_TOKEN</Code>: the token from step 2.
            </li>
            <li>
              <Code>VERCEL_ANALYTICS_PROJECT_ID</Code>: from <em>Settings → General → Project ID</em>. It starts with{" "}
              <Code>prj_</Code>.
            </li>
            <li>
              <Code>VERCEL_ANALYTICS_TEAM_ID</Code>: only if you made a Full Account token instead of a project token.
            </li>
            <li>
              <Code>CRON_SECRET</Code>: 16 or more letters and digits you make up. It protects the daily copy of your
              numbers to Supabase, which runs at 00:30 UTC.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "Redeploy",
      body: (
        <>
          Deployments → … → <em>Redeploy</em>, so the new variables take effect. Then come back here and click{" "}
          <em>Refresh</em>.
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-full bg-(--a-blush) text-xs font-semibold text-(--a-ink) ring-1 ring-(--a-highlight)"
            >
              {i + 1}
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium text-(--a-ink)">{step.title}</p>
              <div className="mt-0.5 text-(--a-ink-soft)">{step.body}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="rounded-md border border-(--a-line) bg-(--a-muted)/50 px-3 py-2 text-sm text-(--a-ink-soft)">
        On the free Hobby plan Vercel may not offer API access to analytics. Clicks on your site are counted here either
        way.
      </p>
    </div>
  );
}
