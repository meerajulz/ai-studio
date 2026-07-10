/**
 * Better Auth — server instance.
 *
 * Uses the Prisma adapter over our shared `prisma` client (Neon), with
 * email + password enabled. The `nextCookies` plugin must be LAST so it can set
 * cookies on Server Actions / route responses.
 *
 * Secrets come from env: BETTER_AUTH_SECRET, BETTER_AUTH_URL.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
