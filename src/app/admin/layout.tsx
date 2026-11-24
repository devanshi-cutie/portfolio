import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import theme from "@/themes/active";
import { cn } from "@/core/admin/lib/cn";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

/**
 * Chrome shared by the login screen and the guarded panel. No auth here.
 * The active theme's brand fonts and palette (--brand-*) are applied on this
 * root so the admin matches the public site; admin.css maps them to --a-* tokens.
 * Radix portals render into #adm-root so dialogs inherit them too.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  const { brand } = theme;
  return (
    <div
      id="adm-root"
      className={cn("adm-root flex min-h-dvh w-full flex-1 flex-col antialiased [color-scheme:light]", brand.fontClassName)}
      style={brand.cssVars as CSSProperties}
    >
      {children}
    </div>
  );
}
