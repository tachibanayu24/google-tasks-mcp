import { describe, expect, it } from 'vitest';
import { parseRetryAfter } from '../../src/lib/rate-limit';

describe('parseRetryAfter', () => {
  it('returns fallback when header is null/empty/undefined', () => {
    expect(parseRetryAfter(null)).toBe(5);
    expect(parseRetryAfter(undefined)).toBe(5);
    expect(parseRetryAfter('')).toBe(5);
    expect(parseRetryAfter(null, { fallbackSec: 10 })).toBe(10);
  });

  it('parses delta-seconds values', () => {
    expect(parseRetryAfter('1')).toBe(1);
    expect(parseRetryAfter('7')).toBe(7);
    expect(parseRetryAfter('30')).toBe(30);
  });

  it('clamps to the configured max (default 30s)', () => {
    expect(parseRetryAfter('60')).toBe(30);
    expect(parseRetryAfter('9999')).toBe(30);
    expect(parseRetryAfter('40', { maxSec: 20 })).toBe(20);
  });

  it('clamps to minimum 1 second', () => {
    expect(parseRetryAfter('0')).toBe(1);
  });

  it('ceils fractional seconds', () => {
    expect(parseRetryAfter('2.1')).toBe(3);
    expect(parseRetryAfter('0.5')).toBe(1);
  });

  it('falls back on non-numeric (HTTP-date etc.)', () => {
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT')).toBe(5);
    expect(parseRetryAfter('abc')).toBe(5);
    expect(parseRetryAfter('-1')).toBe(5);
  });
});
