import { describe, expect, it } from 'vitest';
import { formatLastRun } from './shared';

describe('formatLastRun', () => {
  it('returns an empty string for null', () => {
    expect(formatLastRun(null)).toBe('');
  });

  it('returns time only for a timestamp from today', () => {
    const now = new Date();
    expect(formatLastRun(now.toISOString())).toBe(now.toLocaleTimeString());
  });

  it('prefixes the date for a timestamp from a different day', () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    expect(formatLastRun(past.toISOString())).toBe(
      `${past.toLocaleDateString()} ${past.toLocaleTimeString()}`,
    );
  });
});
