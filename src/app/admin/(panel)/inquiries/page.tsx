import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { listInquiries } from "@/core/data/admin";
import { InquiriesInbox } from "@/core/admin/inquiries/inquiries-inbox";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

export const metadata: Metadata = { title: "Inquiries" };

export default async function InquiriesPage() {
  await requireAdmin();
  const inquiries = await listInquiries();
  return <InquiriesInbox inquiries={inquiries} />;
}
