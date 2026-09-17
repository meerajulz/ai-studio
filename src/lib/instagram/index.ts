/**
 * Public entry point for the Instagram Insights layer (server side).
 *
 *   import { getInsightsSnapshot, getInstagramConfig } from "@/lib/instagram";
 *
 * Client components must go through the Server Actions in `@/actions/instagram` — the
 * access token lives here and never crosses to the browser.
 */
export {
  getInstagramConfig,
  isInstagramConfigured,
  InstagramError,
  isInstagramError,
  type InstagramConfig,
} from "./client";
export { getInsightsSnapshot, resolveRange } from "./insights";
export * from "./types";
