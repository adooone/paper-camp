import { describe, expect, it } from 'vitest';
import { splitPathForDisplay } from './path-display';

describe('splitPathForDisplay', () => {
  it('splits a nested path into directory and basename', () => {
    expect(splitPathForDisplay('papercamp/ideas/IDEA-166.md')).toEqual({
      dir: 'papercamp/ideas/',
      base: 'IDEA-166.md',
    });
  });

  it('treats a path with no slash as a bare basename', () => {
    expect(splitPathForDisplay('README.md')).toEqual({ dir: '', base: 'README.md' });
  });
});
