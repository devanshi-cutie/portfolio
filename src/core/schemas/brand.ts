import { z } from "zod";
import type { BrandInput } from "@/core/types/admin";
import { idSchema, slugSchema, webUrlSchema } from "./common";

export const brandInputSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1, "Required").max(160),
  logoMediaId: idSchema.nullable(),
  websiteUrl: webUrlSchema.nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  featured: z.boolean(),
  published: z.boolean(),
}) satisfies z.ZodType<BrandInput>;
