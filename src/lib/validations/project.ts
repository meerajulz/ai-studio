import { z } from "zod";

export const projectInputSchema = z.object({
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

export type ProjectInput = z.infer<typeof projectInputSchema>;
