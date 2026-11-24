import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, FolderOpen, Images, Inbox, LayoutList, Quote, UserRound } from "lucide-react";
import { requireAdmin } from "@/core/auth/guard";
import { getDashboardStats, listInquiries } from "@/core/data/admin";
import { PageHeader, Panel } from "@/core/admin/ui/misc";
import { focusRing } from "@/core/admin/ui/button";
import { cn } from "@/core/admin/lib/cn";
import { LocalDateTime } from "@/core/admin/inquiries/local-date";
import { RefreshSiteButton } from "@/core/admin/dashboard/refresh-site-button";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireAdmin();
  const [stats, inquiries] = await Promise.all([getDashboardStats(), listInquiries("new")]);
  const recent = inquiries.slice(0, 5);

  const tiles = [
    { label: "New inquiries", value: stats.newInquiries, href: "/admin/inquiries", icon: Inbox, highlight: stats.newInquiries > 0 },
    { label: "Media items", value: stats.media, sub: `${stats.published} published`, href: "/admin/media", icon: Images },
    { label: "Collections", value: stats.collections, href: "/admin/collections", icon: FolderOpen },
    { label: "Brands", value: stats.brands, href: "/admin/brands", icon: Building2 },
    { label: "Testimonials", value: stats.testimonials, href: "/admin/testimonials", icon: Quote },
  ];

  const shortcuts = [
    { href: "/admin/media", label: "Upload new work", body: "Add reels and photos, then sort them into collections.", icon: Images },
    { href: "/admin/profile", label: "Update bio & contact", body: "Name, bio, email, socials and search preview.", icon: UserRound },
    { href: "/admin/sections", label: "Arrange the home page", body: "Reorder, hide or rename sections.", icon: LayoutList },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Everything on your site at a glance." actions={<RefreshSiteButton />} />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(({ label, value, sub, href, icon: Icon, highlight }) => (
          <li key={label}>
            <Link
              href={href}
              className={cn(
                "flex h-full flex-col rounded-lg border bg-(--a-surface) p-4 transition-colors duration-100 hover:border-(--a-line-strong)",
                highlight ? "border-(--a-highlight) bg-(--a-blush)/40" : "border-(--a-line)",
                focusRing,
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-(--a-ink-soft)">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </span>
              <span className="mt-2 text-2xl font-semibold tabular-nums text-(--a-ink)">{value}</span>
              {sub ? <span className="mt-0.5 text-xs text-(--a-ink-soft)">{sub}</span> : null}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Panel
          title="New inquiries"
          actions={
            <Link href="/admin/inquiries" className={cn("rounded text-xs font-medium text-(--a-ink-soft) hover:text-(--a-ink)", focusRing)}>
              Open inbox
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-(--a-ink-soft)">No new inquiries. Messages from your contact form land here.</p>
          ) : (
            <ul className="-my-2 divide-y divide-(--a-line)">
              {recent.map((inquiry) => (
                <li key={inquiry.id}>
                  <Link
                    href={`/admin/inquiries?open=${encodeURIComponent(inquiry.id)}`}
                    className={cn("-mx-2 flex flex-col gap-0.5 rounded-md px-2 py-2.5 hover:bg-(--a-muted)", focusRing)}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-(--a-ink)">
                        {inquiry.name}
                        {inquiry.company ? <span className="font-normal text-(--a-ink-soft)"> · {inquiry.company}</span> : null}
                      </span>
                      <LocalDateTime iso={inquiry.createdAt} className="shrink-0 text-xs text-(--a-ink-soft)" />
                    </span>
                    <span className="line-clamp-1 text-sm text-(--a-ink-soft)">{inquiry.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quick links">
          <ul className="-my-1 flex flex-col gap-1">
            {shortcuts.map(({ href, label, body, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className={cn("group -mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-(--a-muted)", focusRing)}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-(--a-ink-soft)" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-(--a-ink)">{label}</span>
                    <span className="block text-xs text-(--a-ink-soft)">{body}</span>
                  </span>
                  <ArrowRight className="mt-0.5 size-4 text-(--a-ink-faint) transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
