import { Suspense, type ReactNode } from "react";
import { Toaster } from "sonner";
import { CircleAlert, LogOut } from "lucide-react";
import { getAdminUser, isPreviewUser, requireAdmin } from "@/core/auth/guard";
import { cloudinaryFolder, env, isCloudinaryConfigured, isSupabaseConfigured } from "@/core/config/env";
import { signOut } from "@/core/actions/auth";
import { AdminConfigProvider, type AdminConfig } from "@/core/admin/config-context";
import { MobileNav, Sidebar, ViewSiteLink } from "@/core/admin/shell/nav";
import { LikeCounter } from "@/core/admin/shell/like-counter";
import { adminCounter } from "@/core/config/admin-extras";
import { TooltipProvider } from "@/core/admin/ui/tooltip";
import { Button } from "@/core/admin/ui/button";
import { PageSkeleton } from "@/core/admin/ui/misc";
import { getSiteContent } from "@/core/data/site";

/**
 * Guarded admin panel. Static chrome renders immediately; the session check
 * (requireAdmin) and everything below it stream in behind <Suspense>, as
 * cacheComponents requires for cookie reads.
 */
/** Exempts the auth-gated, always-dynamic admin panel from instant-navigation validation. Each page repeats this: the layout alone does not silence the dev insight. */
export const instant = false;

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const { settings } = await getSiteContent();
  const counter = adminCounter();
  const config: AdminConfig = {
    preview: !isSupabaseConfigured(),
    // the browser widget needs the cloud name and the public API key
    cloudinaryReady: isCloudinaryConfigured() && env.cloudinaryApiKey !== "",
    cloudinaryFolder: cloudinaryFolder(),
    siteUrl: "/",
    siteName: settings.identity.name,
  };

  return (
    <AdminConfigProvider value={config}>
      <TooltipProvider>
        <div className="flex min-h-dvh w-full">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-(--a-line) bg-(--a-surface)/90 px-3 backdrop-blur-sm sm:px-5">
              <MobileNav />
              <span className="adm-display truncate text-base whitespace-nowrap lg:hidden">{settings.identity.name || "Site admin"}</span>
              <div className="ml-auto flex items-center gap-1">
                {counter && !config.preview ? <LikeCounter label={counter.label} /> : null}
                <ViewSiteLink />
                <Suspense fallback={null}>
                  <AccountMenu />
                </Suspense>
              </div>
            </header>
            {config.preview ? <PreviewBanner cloudinaryReady={config.cloudinaryReady} /> : null}
            <main id="admin-main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 sm:px-6 sm:py-6">
              <Suspense fallback={<PageSkeleton />}>
                <Guard>{children}</Guard>
              </Suspense>
            </main>
          </div>
        </div>
        <Toaster position="bottom-right" closeButton richColors toastOptions={{ duration: 4000 }} />
      </TooltipProvider>
    </AdminConfigProvider>
  );
}

async function Guard({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

async function AccountMenu() {
  const user = await getAdminUser();
  if (!user) return null;
  if (isPreviewUser(user)) {
    return <span className="px-2 text-xs font-medium text-(--a-ink)">Read-only preview</span>;
  }
  const email = (user as { email?: string | null }).email ?? "Admin";
  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-48 truncate px-2 text-xs text-(--a-ink-soft) md:inline" title={email}>
        {email}
      </span>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
          <LogOut aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </form>
    </div>
  );
}

function PreviewBanner({ cloudinaryReady }: { cloudinaryReady: boolean }) {
  return (
    <div role="status" className="border-b border-(--a-warn-line) bg-(--a-warn-bg) px-4 py-2.5 text-sm text-(--a-ink) sm:px-6">
      <div className="mx-auto flex max-w-6xl items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">Preview mode:</strong> connect Supabase{cloudinaryReady ? "" : " & Cloudinary"} to
          edit. You&apos;re looking at the starter content; changes can&apos;t be saved yet.
        </p>
      </div>
    </div>
  );
}
