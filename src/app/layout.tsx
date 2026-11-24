import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

/*
 * Theme-neutral root. The public site's look lives in `src/themes/<id>` and is
 * applied by `src/app/(site)/layout.tsx`; the admin brings its own chrome.
 * Geist is the neutral UI face for the admin. It is not preloaded, so public
 * pages never download it unless something uses it.
 */
const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap", preload: false });

export const metadata: Metadata = {
  formatDetection: { telephone: false, email: false, address: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
