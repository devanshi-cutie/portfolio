import { z } from "zod";
import type { InquiryInput } from "@/core/types/admin";
import type { InquiryStatus } from "@/core/types/content";

/** Public contact form. Limits mirror the CHECK constraints on `public.inquiries`. */
export const inquiryInputSchema = z.object({
  name: z.string().trim().min(1, "Please tell me your name").max(120),
  email: z.email("Please enter a valid email").max(254),
  company: z.string().trim().max(160).nullable(),
  budget: z.string().trim().max(80).nullable(),
  message: z.string().trim().min(1, "Please write a short message").max(4000),
}) satisfies z.ZodType<InquiryInput>;

export const inquiryStatusSchema = z.enum(["new", "read", "archived"]) satisfies z.ZodType<InquiryStatus>;
