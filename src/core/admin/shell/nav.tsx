"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Camera,
  ExternalLink,
  FolderOpen,
  Images,
  Inbox,
  LayoutDashboard,
  LayoutList,
  Menu,
  Quote,
  UserRound,
} from "lucide-react";
import { cn } from "../lib/cn";
import { focusRing, Button } from "../ui/button";
import { Sheet } from "../ui/dialogs";
import { useAdminConfig } from "../config-context";

export const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/profile", label: "Profile & SEO", icon: UserRound },
  { href: "/admin/sections", label: "Page sections", icon: LayoutList },
  { href: "/admin/media", label: "Media library", icon: Images },
  { href: "/admin/collections", label: "Collections", icon: FolderOpen },
  { href: "/admin/brands", label: "Brands", icon: Building2 },
  { href: "/admin/testimonials", label: "Testimonials", icon: Quote },
  { href: "/admin/instagram", label: "Instagram", icon: Camera },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-md px-3 text-sm text-(--a-ink-soft) transition-colors duration-100 sm:pointer-fine:h-9",
                "hover:bg-(--a-muted) hover:text-(--a-ink)",
                active && "bg-(--a-surface) font-medium text-(--a-ink) shadow-xs ring-1 ring-(--a-line) hover:bg-(--a-surface)",
                focusRing,
              )}
            >
              {active ? <span aria-hidden className="absolute inset-y-2 -left-3 w-0.5 rounded-full bg-(--a-highlight)" /> : null}
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  const { siteName } = useAdminConfig();
  const name = siteName || "Site admin";
  return (
    <Link href="/admin" className={cn("flex items-center gap-2.5 rounded-md px-1 text-(--a-ink)", focusRing)}>
      <span
        aria-hidden
        className="adm-display grid size-8 shrink-0 place-items-center rounded-t-full rounded-b-md bg-(--a-primary) text-sm text-(--a-primary-ink)"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="adm-display truncate text-base">{name}</span>
        <span className="text-[0.7rem] font-semibold tracking-[0.16em] text-(--a-primary) uppercase">Studio</span>
      </span>
    </Link>
  );
}

/** Desktop sidebar (lg and up). */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-(--a-line) bg-(--a-muted)/80 px-3 py-4 lg:flex">
      <div className="mb-5 px-2">
        <Brand />
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2">
        <NavLinks />
      </nav>
    </aside>
  );
}

/** Menu button + slide-in sheet for phones and tablets. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { siteName } = useAdminConfig();
  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen} side="left" title={siteName || "Site admin"}>
        <nav aria-label="Admin" className="-mx-2 pl-2">
          <NavLinks onNavigate={() => setOpen(false)} />
        </nav>
      </Sheet>
    </>
  );
}

export function ViewSiteLink() {
  const { siteUrl } = useAdminConfig();
  return (
    <Button asChild variant="ghost" size="sm">
      <a href={siteUrl || "/"} target="_blank" rel="noreferrer">
        <ExternalLink aria-hidden />
        <span className="sr-only sm:not-sr-only">View site</span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </Button>
  );
}
