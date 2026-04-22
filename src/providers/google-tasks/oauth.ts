import { z } from 'zod';
import type { Env } from '../../env';
import { GoogleAuthError } from '../../lib/errors';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Refresh response from Google. Note: refresh_token is NOT always returned —
// Google may omit it and expect the client to reuse the existing one.
const RefreshResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
  refresh_token: z.string().optional(),
});
type RefreshResponseT = z.infer<typeof RefreshResponse>;

const REFRESH_SKEW_SEC = 60;

export type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
};

async function readStoredTokens(env: Env): Promise<TokenBundle> {
  const [accessToken, refreshToken, expiresAtRaw] = await Promise.all([
    env.TOKENS.get('access_token'),
    env.TOKENS.get('refresh_token'),
    env.TOKENS.get('expires_at'),
  ]);
  if (!refreshToken) {
    throw new GoogleAuthError(
      'Google Tasks refresh_token not found in TOKENS KV. Run `pnpm run setup:google-tasks` on a developer machine and populate the namespace.',
    );
  }
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
  if (expiresAtRaw && !Number.isFinite(expiresAt)) {
    throw new GoogleAuthError(`expires_at in KV is not numeric: ${expiresAtRaw}`);
  }
  return {
    accessToken: accessToken ?? '',
    refreshToken,
    expiresAt,
  };
}

async function persistTokens(
  env: Env,
  tokens: RefreshResponseT,
  existingRefreshToken: string,
  issuedAtSec: number,
): Promise<TokenBundle> {
  const expiresAt = issuedAtSec + tokens.expires_in;
  // Google may or may not return a new refresh_token. Keep the old one if absent.
  const nextRefresh = tokens.refresh_token ?? existingRefreshToken;
  await Promise.all([
    env.TOKENS.put('access_token', tokens.access_token),
    env.TOKENS.put('refresh_token', nextRefresh),
    env.TOKENS.put('expires_at', String(expiresAt)),
  ]);
  return {
    accessToken: tokens.access_token,
    refreshToken: nextRefresh,
    expiresAt,
  };
}

export async function refreshTokens(env: Env, refreshToken: string): Promise<TokenBundle> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new GoogleAuthError(
      'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set. Run `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET`.',
    );
  }

  // Google's Desktop-app OAuth flow expects client_id + client_secret in the
  // form body (not HTTP Basic auth).
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new GoogleAuthError(
      `Token refresh failed: HTTP ${res.status} ${res.statusText} — ${text}`,
    );
  }

  let parsed: RefreshResponseT;
  try {
    parsed = RefreshResponse.parse(JSON.parse(text));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new GoogleAuthError(`Token refresh returned unexpected payload (${reason}): ${text}`);
  }

  const issuedAtSec = Math.floor(Date.now() / 1000);
  return persistTokens(env, parsed, refreshToken, issuedAtSec);
}

/**
 * Returns a currently-valid access token, refreshing it when within
 * REFRESH_SKEW_SEC of expiry. Safe to call on every Google Tasks request.
 */
export async function getAccessToken(env: Env): Promise<string> {
  const current = await readStoredTokens(env);
  const now = Math.floor(Date.now() / 1000);
  if (current.accessToken && current.expiresAt - REFRESH_SKEW_SEC > now) {
    return current.accessToken;
  }
  const refreshed = await refreshTokens(env, current.refreshToken);
  return refreshed.accessToken;
}

/** Force the next `getAccessToken()` to refresh. Used after an unexpected 401. */
export async function invalidateAccessToken(env: Env): Promise<void> {
  await env.TOKENS.put('expires_at', '0');
}
