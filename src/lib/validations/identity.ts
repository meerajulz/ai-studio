import { z } from "zod";

export const identityInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Keep the name under 80 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Keep the description under 500 characters")
    .optional(),
});

export type IdentityInput = z.infer<typeof identityInputSchema>;
