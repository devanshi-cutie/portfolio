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
  <code className="rounded bg-(--a-muted) px-1 py-0.5 text-[0.85em] text-(--a-ink)">{children}</code>
);

/** One-time setup steps for the official Instagram API with Instagram Login. */
export function SetupGuide({ handle }: { handle: string }) {
  const at = handle ? `@${handle}` : "your Instagram account";
  const steps: { title: string; body: ReactNode }[] = [
    {
      title: "Make the account Professional",
      body: (
        <>
          In the Instagram app: Settings → <em>Account type and tools</em> → <em>Switch to professional account</em> →
          Creator (or Business). The account needs to be public. It&apos;s free and your posts don&apos;t change.
        </>
      ),
    },
    {
      title: "Create a free Meta developer app",
      body: (
        <>
          At <A href="https://developers.facebook.com/apps">developers.facebook.com/apps</A> choose <em>Create app</em>,
          pick the use case <em>Other</em>, then the app type <em>Business</em>.
        </>
      ),
    },
    {
      title: "Add Instagram to the app",
      body: (
        <>
          In the app dashboard add the <em>Instagram</em> product and open{" "}
          <em>API setup with Instagram login</em>. Under <em>Generate access tokens</em>, click <em>Add account</em> and
          log in as {at}. Using your own account needs no App Review.
        </>
      ),
    },
    {
      title: "Generate the token",
      body: (
        <>
          Make sure the permissions include <Code>instagram_business_basic</Code> and{" "}
          <Code>instagram_business_manage_insights</Code> (the second one is needed for reel views), then click{" "}
          <em>Generate token</em> next to the account and copy it. Dashboard tokens already last 60 days; there&apos;s no
          extra exchange step.
        </>
      ),
    },
    {
      title: "Paste it below and connect",
      body: (
        <>
          This site checks the token with Instagram and stores it on the server. Each time you fetch, it renews the token
          for another 60 days, so fetching at least once every two months keeps the connection alive.
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
              <p className="mt-0.5 text-(--a-ink-soft)">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <details className="rounded-md border border-(--a-line) bg-(--a-muted)/50 px-3 py-2 text-sm text-(--a-ink-soft)">
        <summary className={cn("flex min-h-11 cursor-pointer items-center rounded font-medium text-(--a-ink) sm:pointer-fine:min-h-8", focusRing)}>
          The dashboard asks for an Instagram tester?
        </summary>
        <p className="pb-1">
          In the app go to <em>App roles → Roles</em>, add {at} as an <em>Instagram Tester</em>, then accept the invite in
          Instagram: Settings → <em>Website permissions</em> → <em>Apps and websites</em> → <em>Tester invites</em>. Then
          generate the token again.
        </p>
      </details>
    </div>
  );
}
