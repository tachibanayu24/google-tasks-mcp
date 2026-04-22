export class GoogleAuthError extends Error {
  readonly code = 'google_auth_error' as const;
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

export class GoogleApiError extends Error {
  readonly code = 'google_api_error' as const;
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
    public readonly endpoint?: string,
  ) {
    super(`Google Tasks API ${status} at ${endpoint ?? '<unknown>'}: ${bodyText.slice(0, 240)}`);
    this.name = 'GoogleApiError';
  }
}

export class GoogleRateLimitError extends Error {
  readonly code = 'google_rate_limit_error' as const;
  constructor(
    public readonly retryAfterSec: number,
    public readonly endpoint?: string,
  ) {
    super(
      `Google Tasks rate limit exceeded at ${endpoint ?? '<unknown>'} (Retry-After: ${retryAfterSec}s)`,
    );
    this.name = 'GoogleRateLimitError';
  }
}

export type ToolTextResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export function toolErrorResult(err: unknown): ToolTextResult {
  const message = err instanceof Error ? err.message : String(err);
  let hint = '';
  if (err instanceof GoogleAuthError) {
    hint =
      '\n\nHint: tokens may be missing, expired, or revoked. ' +
      'Re-run `pnpm run setup:google-tasks` from a developer machine and repopulate the TOKENS KV namespace.';
  } else if (err instanceof GoogleRateLimitError) {
    hint = `\n\nHint: retry after ${err.retryAfterSec}s. Google Tasks API default quota is 50,000/day.`;
  } else if (err instanceof GoogleApiError) {
    if (err.status === 404) {
      hint =
        '\n\nHint: the task list or task id was not found. Use `list_tasklists` to discover valid ids.';
    } else if (err.status === 400 && /assignmentInfo|recurring/i.test(err.bodyText)) {
      hint =
        "\n\nHint: recurring / assigned tasks (from Docs/Chat) can't be moved across lists or become subtasks.";
    } else if (err.status === 403) {
      hint =
        '\n\nHint: permission denied. Your OAuth scope may lack `https://www.googleapis.com/auth/tasks`; re-run setup if so.';
    }
  }
  return {
    content: [{ type: 'text', text: `Error: ${message}${hint}` }],
    isError: true,
  };
}
