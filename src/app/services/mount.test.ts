import { describe, expect, it } from 'vitest';
import { deriveMountPrefix } from './mount';

describe('deriveMountPrefix', () => {
  it('is empty for the standalone camp root', () => {
    expect(deriveMountPrefix('http://localhost:3333/')).toBe('');
  });

  it('returns the mount directory when embedded under a prefix', () => {
    expect(deriveMountPrefix('http://localhost:5173/paper-camp/')).toBe('/paper-camp');
  });

  it('tolerates the legacy dunder route prefix', () => {
    expect(deriveMountPrefix('http://localhost:5173/__camp/')).toBe('/__camp');
  });
});
