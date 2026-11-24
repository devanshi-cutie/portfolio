import { z } from "zod";
import type { CollectionInput } from "@/core/types/admin";
import { idSchema, optionalText, slugSchema } from "./common";

export const collectionInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1, "Required").max(160),
  description: optionalText(1000),
  coverMediaId: idSchema.nullable(),
  published: z.boolean(),
}) satisfies z.ZodType<CollectionInput>;
