import { describe, expect, it } from 'vitest';
import { diffWords } from './diff';

describe('diffWords', () => {
  it('returns a single same token when both strings are identical', () => {
    expect(diffWords('fix the path', 'fix the path')).toEqual([
      { type: 'same', text: 'fix the path' },
    ]);
  });

  it('marks only the changed span, keeping unchanged prose as same', () => {
    expect(diffWords('reads config.json for the id', 'reads config.ts for the id')).toEqual([
      { type: 'same', text: 'reads ' },
      { type: 'removed', text: 'config.json' },
      { type: 'added', text: 'config.ts' },
      { type: 'same', text: ' for the id' },
    ]);
  });

  it('treats an empty before as fully added', () => {
    expect(diffWords('', 'new text')).toEqual([{ type: 'added', text: 'new text' }]);
  });

  it('treats an empty after as fully removed', () => {
    expect(diffWords('old text', '')).toEqual([{ type: 'removed', text: 'old text' }]);
  });
});
