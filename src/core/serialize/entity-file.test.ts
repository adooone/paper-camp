import { describe, expect, it } from 'vitest';
import { nowMinuteString } from './entity-file';

describe('nowMinuteString', () => {
  it('formats as an ISO date with minute precision', () => {
    expect(nowMinuteString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
