import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAuthError } from '../../../src/lib/errors';
import {
  getAccessToken,
  invalidateAccessToken,
  refreshTokens,
} from '../../../src/providers/google-tasks/oauth';
import { createMockEnv } from '../../helpers/mock-env';

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns current access_token when not near expiry', async () => {
    const env = createMockEnv({
      access_token: 'current-token',
      refresh_token: 'refresh-xyz',
      expires_at: String(Math.floor(Date.now() / 1000) + 600),
    });
    const token = await getAccessToken(env);
    expect(token).toBe('current-token');
  });

  it('refreshes when access_token is within the 60-second skew window', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: 'new-token',
            // note: Google often omits refresh_token on refresh — ensure we keep the old one.
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/tasks',
            token_type: 'Bearer',
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const env = createMockEnv({
      access_token: 'stale',
      refresh_token: 'refresh-xyz',
      expires_at: String(Math.floor(Date.now() / 1000) + 30),
    });

    const token = await getAccessToken(env);
    expect(token).toBe('new-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await env.TOKENS.get('access_token')).toBe('new-token');
    // refresh_token should be preserved when Google omits it in the response.
    expect(await env.TOKENS.get('refresh_token')).toBe('refresh-xyz');
  });

  it('updates refresh_token when Google sends a new one', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: 'new-token',
            refresh_token: 'rotated-refresh',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const env = createMockEnv({
      access_token: 'stale',
      refresh_token: 'old-refresh',
      expires_at: String(Math.floor(Date.now() / 1000) + 30),
    });

    await getAccessToken(env);
    expect(await env.TOKENS.get('refresh_token')).toBe('rotated-refresh');
  });

  it('throws GoogleAuthError when refresh_token is missing', async () => {
    const env = createMockEnv();
    await expect(getAccessToken(env)).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('throws GoogleAuthError when expires_at is not numeric', async () => {
    const env = createMockEnv({
      refresh_token: 'r',
      expires_at: 'garbage',
    });
    await expect(getAccessToken(env)).rejects.toBeInstanceOf(GoogleAuthError);
  });
});

describe('refreshTokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('persists the new bundle with expires_at = now + expires_in', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: 'a2',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/tasks',
            token_type: 'Bearer',
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const env = createMockEnv();
    const result = await refreshTokens(env, 'old-refresh');

    expect(result.accessToken).toBe('a2');
    expect(result.refreshToken).toBe('old-refresh');
    const nowSec = Math.floor(Date.now() / 1000);
    expect(result.expiresAt).toBe(nowSec + 3600);
    expect(await env.TOKENS.get('expires_at')).toBe(String(nowSec + 3600));
  });

  it('sends client_id/client_secret/refresh_token in the form body to /token', async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            access_token: 'a2',
            expires_in: 100,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const env = createMockEnv();
    await refreshTokens(env, 'rt');

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error('fetch was not called');
    const [url, init] = call;
    expect(String(url)).toBe('https://oauth2.googleapis.com/token');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    // Google uses form body — no Basic auth header.
    expect(headers.Authorization).toBeUndefined();
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt');
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
  });

  it('throws GoogleAuthError with the response body on HTTP 4xx/5xx', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"error":"invalid_grant"}', { status: 400, statusText: 'Bad Request' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const env = createMockEnv();
    await expect(refreshTokens(env, 'rt')).rejects.toThrow(/invalid_grant/);
  });

  it('throws GoogleAuthError when client id / secret are absent', async () => {
    const env = createMockEnv({}, { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
    await expect(refreshTokens(env, 'rt')).rejects.toBeInstanceOf(GoogleAuthError);
  });
});

describe('invalidateAccessToken', () => {
  it('writes expires_at=0 so the next getAccessToken is forced to refresh', async () => {
    const env = createMockEnv({
      access_token: 'a',
      refresh_token: 'r',
      expires_at: '9999999999',
    });
    await invalidateAccessToken(env);
    expect(await env.TOKENS.get('expires_at')).toBe('0');
  });
});
