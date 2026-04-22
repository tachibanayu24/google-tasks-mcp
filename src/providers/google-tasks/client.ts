import type { z } from 'zod';
import type { Env } from '../../env';
import { GoogleApiError, GoogleRateLimitError } from '../../lib/errors';
import { parseRetryAfter, sleep } from '../../lib/rate-limit';
import { getAccessToken, invalidateAccessToken } from './oauth';

const API_BASE = 'https://tasks.googleapis.com/tasks/v1';

export type GoogleTasksRequest = {
  /** Path after `/tasks/v1`, e.g. `/users/@me/lists` or `/lists/{id}/tasks`. */
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Query parameters appended to the URL. */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON body (serialized to application/json). */
  jsonBody?: unknown;
};

const MAX_ATTEMPTS = 3;

export class GoogleTasksClient {
  constructor(private readonly env: Env) {}

  async requestJson<S extends z.ZodTypeAny>(
    schema: S,
    req: GoogleTasksRequest,
  ): Promise<z.output<S>> {
    const text = await this.requestText(req);
    if (!text) {
      throw new GoogleApiError(200, `Empty body where JSON was expected at ${req.path}`, req.path);
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new GoogleApiError(200, `Invalid JSON at ${req.path} (${reason}): ${text}`, req.path);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const rawPreview = text.length > 500 ? `${text.slice(0, 500)}…` : text;
      throw new GoogleApiError(
        200,
        `Schema validation failed at ${req.path}: ${parsed.error.message}\nRaw body preview: ${rawPreview}`,
        req.path,
      );
    }
    return parsed.data;
  }

  /** For DELETE / clear which return 204 No Content. Drops the body. */
  async requestVoid(req: GoogleTasksRequest): Promise<void> {
    await this.doRequest(req);
  }

  async requestText(req: GoogleTasksRequest): Promise<string> {
    const res = await this.doRequest(req);
    return res.text();
  }

  private async doRequest(req: GoogleTasksRequest): Promise<Response> {
    const url = new URL(API_BASE + req.path);
    if (req.query) {
      for (const [k, v] of Object.entries(req.query)) {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }

    let attempt = 0;
    while (true) {
      attempt++;
      const token = await getAccessToken(this.env);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };
      let body: BodyInit | undefined;
      if (req.jsonBody !== undefined) {
        body = JSON.stringify(req.jsonBody);
        headers['Content-Type'] = 'application/json';
      }

      const method = req.method ?? 'GET';
      const t0 = Date.now();
      const res = await fetch(url, { method, headers, body });
      const ms = Date.now() - t0;

      if (res.status === 401 && attempt === 1) {
        console.log(`[gtasks] ${method} ${req.path} → 401 after ${ms}ms, refreshing token`);
        await invalidateAccessToken(this.env);
        continue;
      }

      if (res.status === 429) {
        const waitSec = parseRetryAfter(res.headers.get('Retry-After'));
        if (attempt < MAX_ATTEMPTS) {
          console.log(`[gtasks] ${method} ${req.path} → 429, sleeping ${waitSec}s before retry`);
          await sleep(waitSec * 1000);
          continue;
        }
        throw new GoogleRateLimitError(waitSec, req.path);
      }

      if (!res.ok) {
        const text = await res.text();
        console.log(
          `[gtasks] ${method} ${req.path} → ${res.status} after ${ms}ms: ${text.slice(0, 300)}`,
        );
        throw new GoogleApiError(res.status, text, req.path);
      }
      return res;
    }
  }
}
