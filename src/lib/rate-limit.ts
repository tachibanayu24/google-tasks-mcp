export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse a `Retry-After` header value (delta-seconds) and clamp it.
 * HTTP-date form is treated as "use fallback" to avoid surprise long waits.
 */
export function parseRetryAfter(
  header: string | null | undefined,
  opts: { fallbackSec?: number; maxSec?: number } = {},
): number {
  const { fallbackSec = 5, maxSec = 30 } = opts;
  if (!header) return fallbackSec;
  const n = Number(header);
  if (!Number.isFinite(n) || n < 0) return fallbackSec;
  return Math.min(maxSec, Math.max(1, Math.ceil(n)));
}
