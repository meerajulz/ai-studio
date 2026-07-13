import { headers } from "next/headers";

import { auth } from "./auth";

/**
 * Resolve the current session's user id, or throw. Every owner-scoped Server Action
 * starts here so a user can only ever touch their own data (projects, uploads, …).
 */
export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}
