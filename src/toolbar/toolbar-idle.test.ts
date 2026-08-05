import { describe, expect, it } from 'vitest';
import { shouldCollapse } from './toolbar-idle';

describe('shouldCollapse', () => {
  it('stays expanded before the idle threshold', () => {
    expect(shouldCollapse(2999, 3000, false)).toBe(false);
  });

  it('collapses once idle time reaches the threshold', () => {
    expect(shouldCollapse(3000, 3000, false)).toBe(true);
    expect(shouldCollapse(9000, 3000, false)).toBe(true);
  });

  it('never collapses while a panel is open, regardless of idle time', () => {
    expect(shouldCollapse(999999, 3000, true)).toBe(false);
  });
});
