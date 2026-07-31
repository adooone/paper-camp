import { describe, expect, it } from 'vitest';
import { parsePatch } from './parse-diff';

describe('parsePatch', () => {
  it('returns no hunks for an empty patch', () => {
    expect(parsePatch('')).toEqual([]);
  });

  it('parses a unified diff into hunks with typed lines', () => {
    const patch = [
      'diff --git a/foo.ts b/foo.ts',
      'index abc..def 100644',
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1,3 +1,3 @@',
      ' kept line',
      '-removed line',
      '+added line',
      '',
    ].join('\n');

    expect(parsePatch(patch)).toEqual([
      {
        header: '@@ -1,3 +1,3 @@',
        lines: [
          { type: 'context', text: 'kept line' },
          { type: 'remove', text: 'removed line' },
          { type: 'add', text: 'added line' },
        ],
      },
    ]);
  });

  it('splits multiple hunks in the same patch', () => {
    const patch = [
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
      '@@ -10,1 +10,1 @@',
      '-old2',
      '+new2',
      '',
    ].join('\n');

    const hunks = parsePatch(patch);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].header).toBe('@@ -1,1 +1,1 @@');
    expect(hunks[1].header).toBe('@@ -10,1 +10,1 @@');
  });

  it('returns no hunks for a pure-rename diff with no content change', () => {
    const patch = [
      'diff --git a/old.txt b/new.txt',
      'similarity index 100%',
      'rename from old.txt',
      'rename to new.txt',
    ].join('\n');
    expect(parsePatch(patch)).toEqual([]);
  });

  it('treats raw content with no @@ marker as one all-added hunk', () => {
    const patch = 'line one\nline two';
    expect(parsePatch(patch)).toEqual([
      {
        header: '',
        lines: [
          { type: 'add', text: 'line one' },
          { type: 'add', text: 'line two' },
        ],
      },
    ]);
  });
});
