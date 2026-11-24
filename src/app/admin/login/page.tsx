import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSiteContent } from "@/core/data/site";
import { imageUrl } from "@/core/cloudinary/urls";
import { isAdminPasswordConfigured, isAdminPreviewMode } from "@/core/auth/mode";
import { LoginForm } from "@/core/admin/auth/login-form";
import { loginConsent } from "@/core/config/admin-extras";
import { TimeGreeting } from "@/core/admin/auth/greeting";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Personal sign-in: the creator's portrait (Profile → portrait) and a welcome
 * by first name. Everything comes from settings, so it works for any creator.
 * Not guarded: the (panel) layout redirects here, so guarding it would loop.
 */
export default async function LoginPage() {
  const { settings, mediaById } = await getSiteContent();
  const { name, handle, portraitMediaId } = settings.identity;
  const firstName = (name || "").trim().split(/\s+/)[0] || "there";
  const portrait = portraitMediaId ? mediaById[portraitMediaId] : undefined;
  const portraitSrc = portrait && portrait.resourceType === "image" ? imageUrl(portrait, { width: 720, height: 900, crop: "fill", gravity: "face" }) : null;
  const preview = isAdminPreviewMode();
  const configured = isAdminPasswordConfigured();

  return (
    <main className="adm-login relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8 sm:py-12">
      <div aria-hidden className="adm-login-pattern pointer-events-none absolute inset-0" />

      <div className="relative grid w-full max-w-4xl items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
        {/* Portrait */}
        <div className="adm-login-in flex justify-center md:justify-end">
          <figure className="relative w-44 sm:w-52 md:w-full md:max-w-[340px]">
            <div className="adm-login-portrait relative aspect-[4/5] overflow-hidden border-[6px] border-(--a-surface) bg-(--a-muted)">
              {portraitSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary/dev-media URL, sized by the CDN
                <img src={portraitSrc} alt={portrait?.alt || name} width={720} height={900} fetchPriority="high" className="size-full object-cover" />
              ) : (
                <div aria-hidden className="adm-display grid size-full place-items-center text-7xl text-(--a-primary)">
                  {firstName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {handle ? (
              <figcaption className="adm-login-tag absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-(--a-line) bg-(--a-surface) px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-(--a-ink) md:-bottom-4 md:text-sm">
                @{handle}
              </figcaption>
            ) : null}
          </figure>
        </div>

        {/* Welcome + form */}
        <div className="adm-login-in adm-login-in-2 mx-auto w-full max-w-sm pt-3 md:mx-0 md:pt-0">
          <div className="mb-6 text-center md:text-left">
            <p className="text-xs font-semibold tracking-[0.18em] text-(--a-primary) uppercase">
              <TimeGreeting />
            </p>
            <h1 className="adm-display mt-2 text-4xl leading-[1.05] font-medium text-(--a-ink) sm:text-5xl">
              Welcome back, <em className="text-(--a-primary)">{firstName}</em>
            </h1>
            <p className="mt-3 text-[0.95rem] text-(--a-ink-soft)">Your studio is ready. What are we sharing today?</p>
          </div>

          <div className="adm-login-card border border-(--a-line) bg-(--a-surface) p-5 sm:p-6">
            {!configured ? (
              preview ? (
                <div role="status" className="rounded-2xl border border-(--a-warn-line) bg-(--a-warn-bg) px-4 py-3 text-sm text-(--a-ink)">
                  <p>
                    <strong className="font-semibold">Preview mode.</strong> Nothing is connected yet, so the admin opens read-only.
                  </p>
                  <Link href="/admin" className="mt-2 inline-block font-medium text-(--a-primary) underline underline-offset-2">
                    Open read-only preview
                  </Link>
                </div>
              ) : (
                <div role="alert" className="rounded-2xl border border-(--a-warn-line) bg-(--a-warn-bg) px-4 py-3 text-sm text-(--a-ink)">
                  <p className="font-semibold">Admin password is not configured</p>
                  <p className="mt-1 text-(--a-ink-soft)">
                    Set <code className="rounded bg-(--a-muted) px-1 py-0.5 text-[0.8em]">ADMIN_PASSWORD</code> in your environment variables (Vercel → Settings →
                    Environment Variables) and redeploy.
                  </p>
                </div>
              )
            ) : (
              <Suspense>
                <LoginForm consent={loginConsent()} />
              </Suspense>
            )}
          </div>

          <p className="mt-5 text-center text-sm text-(--a-ink-soft) md:text-left">
            <Link href="/" className="inline-flex min-h-11 items-center rounded underline-offset-4 hover:text-(--a-ink) hover:underline">
              ← Back to the site
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
