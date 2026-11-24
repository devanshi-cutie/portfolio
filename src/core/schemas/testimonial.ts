import { z } from "zod";
import type { TestimonialInput } from "@/core/types/admin";
import { idSchema, optionalText } from "./common";

export const testimonialInputSchema = z.object({
  quote: z.string().trim().min(1, "Required").max(3000),
  authorName: optionalText(160),
  authorRole: optionalText(160),
  brandId: idSchema.nullable(),
  avatarMediaId: idSchema.nullable(),
  published: z.boolean(),
}) satisfies z.ZodType<TestimonialInput>;
