import { describe, expect, it } from 'vitest';
import { readMountPrefix } from './mount';

function root(mount: string | null): { getAttribute(name: string): string | null } {
  return { getAttribute: () => mount };
}

describe('readMountPrefix', () => {
  it('is empty when the standalone serving layer injects no mount', () => {
    expect(readMountPrefix(root(null))).toBe('');
  });

  it('is empty when the root element is missing', () => {
    expect(readMountPrefix(null)).toBe('');
  });

  it('returns the injected mount when embedded under a prefix', () => {
    expect(readMountPrefix(root('/paper-camp'))).toBe('/paper-camp');
  });

  it('reads the injected mount, not the page URL, so a deep-link reload does not poison it', () => {
    expect(readMountPrefix(root(''))).toBe('');
    expect(readMountPrefix(root('/paper-camp'))).toBe('/paper-camp');
  });
});
