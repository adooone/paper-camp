import { describe, expect, it } from 'vitest';
import { capacityLevel, resetsAtMs } from './rate-limit';

describe('capacityLevel', () => {
  it('treats only an exact "allowed" as the safe level', () => {
    expect(capacityLevel('allowed')).toBe('allowed');
    expect(capacityLevel('allowed_warning')).toBe('warning');
    expect(capacityLevel('warning')).toBe('warning');
  });

  it('classifies rejection-flavoured statuses as rejected', () => {
    expect(capacityLevel('rejected')).toBe('rejected');
    expect(capacityLevel('blocked')).toBe('rejected');
    expect(capacityLevel('exceeded')).toBe('rejected');
  });
});

describe('resetsAtMs', () => {
  it('scales second-granularity timestamps to milliseconds', () => {
    expect(resetsAtMs(1_700_000_000)).toBe(1_700_000_000_000);
  });

  it('passes millisecond timestamps through untouched', () => {
    expect(resetsAtMs(1_700_000_000_000)).toBe(1_700_000_000_000);
  });
});
