/**
 * Instagram Graph API — low-level client (Milestone: Instagram Insights).
 *
 * The single file that knows the wire format. `fetch`-based (no SDK), server-only: the
 * access token is a long-lived credential and must never reach the browser.
 *
 * Auth model — a single-account setup, which is what this dashboard is for:
 *   IG_ACCESS_TOKEN  long-lived Page access token (60 days, refreshable)
 *   IG_USER_ID       the Instagram Business/Creator account id (NOT the @handle)
 *   IG_GRAPH_VERSION optional pin, e.g. "v23.0"
 * See docs/INSTAGRAM_INSIGHTS.md for how to obtain both.
 */

const DEFAULT_VERSION = "v23.0";
const API_BASE = "https://graph.facebook.com";

/** Graph API error codes we can explain better than Meta does. */
const FRIENDLY_CODES: Record<number, string> = {
  4: "Instagram's rate limit is reached. Wait an hour and try again.",
  10: "This account is missing a permission. Re-authorize with instagram_basic and instagram_manage_insights.",
  100: "Instagram rejected a field or metric — usually a metric this account type doesn't serve, or one retired in this API version.",
  190: "The access token expired or was revoked. Generate a new long-lived token and update IG_ACCESS_TOKEN.",
  200: "The token lacks instagram_manage_insights, so Meta won't return Insights data.",
};

export class InstagramError extends Error {
  readonly code: number | null;
  readonly subcode: number | null;
  readonly status: number | null;

  constructor(
    message: string,
    options: {
      code?: number | null;
      subcode?: number | null;
      status?: number | null;
    } = {},
  ) {
    super(message);
    this.name = "InstagramError";
    this.code = options.code ?? null;
    this.subcode = options.subcode ?? null;
    this.status = options.status ?? null;
  }
}

export function isInstagramError(error: unknown): error is InstagramError {
  return error instanceof InstagramError;
}

export type InstagramConfig = {
  accessToken: string;
  userId: string;
  version: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/** True when both credentials are present — lets the UI show setup steps instead of an error. */
export function isInstagramConfigured(): boolean {
  return Boolean(readEnv("IG_ACCESS_TOKEN") && readEnv("IG_USER_ID"));
}

export function getInstagramConfig(): InstagramConfig {
  const accessToken = readEnv("IG_ACCESS_TOKEN");
  const userId = readEnv("IG_USER_ID");

  if (!accessToken || !userId) {
    throw new InstagramError(
      "Instagram is not connected. Set IG_ACCESS_TOKEN and IG_USER_ID — see docs/INSTAGRAM_INSIGHTS.md.",
    );
  }

  return {
    accessToken,
    userId,
    version: readEnv("IG_GRAPH_VERSION") ?? DEFAULT_VERSION,
  };
}

type GraphErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

/**
 * GET a Graph API node. `params` is everything but the token, which is appended here so no
 * caller has to handle it (and so it never lands in a log line or an error message).
 */
export async function graphGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  config: InstagramConfig = getInstagramConfig(),
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  search.set("access_token", config.accessToken);

  const url = `${API_BASE}/${config.version}/${path}?${search.toString()}`;

  let response: Response;
  try {
    // Insights change at most hourly; a short revalidate keeps the dashboard snappy
    // without serving yesterday's numbers.
    response = await fetch(url, { next: { revalidate: 300 } });
  } catch (cause) {
    throw new InstagramError(
      `Could not reach the Instagram Graph API: ${cause instanceof Error ? cause.message : "network error"}`,
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok || (body as GraphErrorBody)?.error) {
    const error = (body as GraphErrorBody)?.error;
    const code = error?.code ?? null;
    const friendly = code !== null ? FRIENDLY_CODES[code] : undefined;
    const detail = error?.message ?? `HTTP ${response.status}`;
    throw new InstagramError(
      friendly ? `${friendly} (Meta said: ${detail})` : detail,
      {
        code,
        subcode: error?.error_subcode ?? null,
        status: response.status,
      },
    );
  }

  return body as T;
}
