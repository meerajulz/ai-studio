/**
 * Better Auth catch-all route handler.
 * Exposes all Better Auth endpoints under /api/auth/*.
 */
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth.handler);
