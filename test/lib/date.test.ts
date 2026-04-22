import { describe, expect, it } from 'vitest';
import {
  assertFilterTimestamp,
  assertIsoDate,
  assertRfc3339,
  normalizeDue,
} from '../../src/lib/date';

describe('assertIsoDate', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(() => assertIsoDate('2026-04-22')).not.toThrow();
    expect(() => assertIsoDate('2026-01-01')).not.toThrow();
    expect(() => assertIsoDate('2026-12-31')).not.toThrow();
  });

  it('rejects invalid formats', () => {
    expect(() => assertIsoDate('')).toThrow(RangeError);
    expect(() => assertIsoDate('2026-4-22')).toThrow(RangeError);
    expect(() => assertIsoDate('2026-04-22T00:00:00Z')).toThrow(RangeError);
    expect(() => assertIsoDate('2026-13-01')).toThrow(RangeError);
    expect(() => assertIsoDate('2026-04-32')).toThrow(RangeError);
    expect(() => assertIsoDate('not a date')).toThrow(RangeError);
  });
});

describe('assertRfc3339', () => {
  it('accepts canonical forms', () => {
    expect(() => assertRfc3339('2026-04-22T00:00:00Z')).not.toThrow();
    expect(() => assertRfc3339('2026-04-22T12:34:56.789Z')).not.toThrow();
    expect(() => assertRfc3339('2026-04-22T12:34:56+09:00')).not.toThrow();
    expect(() => assertRfc3339('2026-04-22T12:34:56-05:00')).not.toThrow();
  });

  it('rejects bare dates and wrong forms', () => {
    expect(() => assertRfc3339('2026-04-22')).toThrow(RangeError);
    expect(() => assertRfc3339('2026/04/22T12:00:00Z')).toThrow(RangeError);
    expect(() => assertRfc3339('2026-04-22 12:00:00Z')).toThrow(RangeError);
  });
});

describe('normalizeDue', () => {
  it('converts YYYY-MM-DD to midnight UTC RFC3339', () => {
    expect(normalizeDue('2026-04-22')).toBe('2026-04-22T00:00:00.000Z');
  });

  it('coerces RFC3339 to midnight UTC on the same UTC calendar date', () => {
    expect(normalizeDue('2026-04-22T13:45:00Z')).toBe('2026-04-22T00:00:00.000Z');
    expect(normalizeDue('2026-04-22T23:59:59.999Z')).toBe('2026-04-22T00:00:00.000Z');
    // +09:00 at 08:00 local is 2026-04-21T23:00:00Z → 2026-04-21 UTC.
    expect(normalizeDue('2026-04-22T08:00:00+09:00')).toBe('2026-04-21T00:00:00.000Z');
  });

  it('throws on invalid input', () => {
    expect(() => normalizeDue('')).toThrow(RangeError);
    expect(() => normalizeDue('tomorrow')).toThrow(RangeError);
    expect(() => normalizeDue('2026-13-01')).toThrow(RangeError);
  });
});

describe('assertFilterTimestamp', () => {
  it('passes through valid RFC3339', () => {
    expect(assertFilterTimestamp('2026-04-22T00:00:00Z', 'completedMin')).toBe(
      '2026-04-22T00:00:00Z',
    );
  });

  it('upgrades YYYY-MM-DD to midnight UTC RFC3339', () => {
    expect(assertFilterTimestamp('2026-04-22', 'completedMin')).toBe('2026-04-22T00:00:00.000Z');
  });

  it('throws on garbage', () => {
    expect(() => assertFilterTimestamp('nope', 'completedMin')).toThrow(RangeError);
  });
});
