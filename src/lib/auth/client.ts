/**
 * Better Auth — browser client (for Client Components).
 *
 *   "use client";
 *   import { signIn, signUp, signOut, useSession } from "@/lib/auth/client";
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
