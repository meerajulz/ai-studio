/**
 * Public entry point for the auth layer (server side).
 *
 *   import { auth } from "@/lib/auth";
 *   const session = await auth.api.getSession({ headers: await headers() });
 *
 * For client components, import from "@/lib/auth/client" instead.
 */
export { auth } from "./auth";
export type { Session } from "./auth";
