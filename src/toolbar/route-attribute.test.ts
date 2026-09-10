import { describe, expect, it } from 'vitest';
import { scriptOrigin } from './route-attribute';

describe('scriptOrigin', () => {
  it('reads the origin off an absolute script src', () => {
    expect(scriptOrigin({ src: 'http://localhost:4333/p/demo/toolbar.js' })).toBe(
      'http://localhost:4333',
    );
  });

  it('is undefined for a script with no src', () => {
    expect(scriptOrigin({ src: '' })).toBeUndefined();
  });

  it('is undefined for a missing script element', () => {
    expect(scriptOrigin(null)).toBeUndefined();
    expect(scriptOrigin(undefined)).toBeUndefined();
  });

  it('is undefined for a src that fails to parse as a URL', () => {
    expect(scriptOrigin({ src: 'not a url' })).toBeUndefined();
  });
});
