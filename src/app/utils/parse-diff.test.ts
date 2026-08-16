import { describe, expect, it } from 'vitest';
import { parsePatch, rawContentHunks } from './parse-diff';

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
          { type: 'context', text: 'kept line', oldLine: 1, newLine: 1 },
          { type: 'remove', text: 'removed line', oldLine: 2, newLine: null },
          { type: 'add', text: 'added line', oldLine: null, newLine: 2 },
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

  it('returns no hunks for a patch with no @@ marker', () => {
    const patch = 'line one\nline two';
    expect(parsePatch(patch)).toEqual([]);
  });
});

describe('rawContentHunks', () => {
  it('returns no hunks for empty content', () => {
    expect(rawContentHunks('')).toEqual([]);
  });

  it('treats every line as added, even one that looks like a diff hunk header', () => {
    const content = 'line one\n@@ -1,1 +1,1 @@\nline two';
    expect(rawContentHunks(content)).toEqual([
      {
        header: '',
        lines: [
          { type: 'add', text: 'line one', oldLine: null, newLine: 1 },
          { type: 'add', text: '@@ -1,1 +1,1 @@', oldLine: null, newLine: 2 },
          { type: 'add', text: 'line two', oldLine: null, newLine: 3 },
        ],
      },
    ]);
  });
});
