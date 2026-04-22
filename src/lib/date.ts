const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const RFC3339_RE =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function assertIsoDate(value: string, field = 'date'): asserts value is string {
  if (!ISO_DATE_RE.test(value)) {
    throw new RangeError(`${field} must be YYYY-MM-DD (got: ${value})`);
  }
}

export function assertRfc3339(value: string, field = 'timestamp'): asserts value is string {
  if (!RFC3339_RE.test(value)) {
    throw new RangeError(`${field} must be RFC3339 (got: ${value})`);
  }
}

/**
 * Normalize a user-supplied `due` value for Google Tasks.
 *
 * Google Tasks stores `due` with only the date component (time is silently
 * dropped). To get consistent behavior we always send midnight UTC in RFC3339.
 *
 * - `YYYY-MM-DD`         → `YYYY-MM-DDT00:00:00.000Z`
 * - full RFC3339         → coerced to midnight UTC on the same calendar date
 * - anything else        → RangeError
 */
export function normalizeDue(input: string, field = 'due'): string {
  if (ISO_DATE_RE.test(input)) {
    return `${input}T00:00:00.000Z`;
  }
  if (RFC3339_RE.test(input)) {
    // Parse, extract Y-M-D in UTC, rebuild as midnight UTC.
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
      throw new RangeError(`${field} is not a valid RFC3339 timestamp: ${input}`);
    }
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}T00:00:00.000Z`;
  }
  throw new RangeError(`${field} must be YYYY-MM-DD or RFC3339 (got: ${input})`);
}

/**
 * Validate and return a timestamp for filter fields like `completedMin`,
 * `updatedMin`. Google expects RFC3339, so we require it (unlike `due`).
 */
export function assertFilterTimestamp(value: string, field: string): string {
  if (RFC3339_RE.test(value)) return value;
  if (ISO_DATE_RE.test(value)) return `${value}T00:00:00.000Z`;
  throw new RangeError(`${field} must be YYYY-MM-DD or RFC3339 (got: ${value})`);
}
