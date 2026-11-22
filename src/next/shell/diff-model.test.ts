import { describe, expect, it } from 'vitest';
import type { FileDiffEntry } from '@/types/index';
import {
  COLLAPSE_LINE_THRESHOLD,
  diffBody,
  diffCounts,
  diffPathLabel,
  diffSummary,
  isDiffCollapsed,
} from './diff-model';

const entry = (extra: Partial<FileDiffEntry> = {}): FileDiffEntry => ({
  path: 'src/a.ts',
  status: ' M',
  staged: false,
  binary: false,
  additions: 2,
  deletions: 1,
  contentKind: 'diff',
  patch: '@@ -1 +1,2 @@\n-a\n+b\n+c\n',
  ...extra,
});

describe('diffBody', () => {
  it('hands the patch to the code block without its trailing newline', () => {
    expect(diffBody(entry())).toEqual({ kind: 'code', code: '@@ -1 +1,2 @@\n-a\n+b\n+c' });
    expect(diffBody(entry({ contentKind: 'raw', patch: 'hello\n' }))).toEqual({
      kind: 'code',
      code: 'hello',
    });
  });

  it('explains the files it cannot show', () => {
    expect(diffBody(entry({ binary: true }))).toEqual({
      kind: 'note',
      text: 'Binary file not shown.',
    });
    expect(diffBody(entry({ contentKind: 'too-large', patch: '' }))).toEqual({
      kind: 'note',
      text: 'File too large to preview.',
    });
    expect(diffBody(entry({ patch: '' }))).toEqual({
      kind: 'note',
      text: 'No changes to preview.',
    });
  });

  it('tells a pure rename from a rename with unrelated content', () => {
    const renamed = { patch: '', renameSource: 'old.ts' };
    expect(diffBody(entry({ ...renamed, additions: 0, deletions: 0 }))).toEqual({
      kind: 'note',
      text: 'Renamed, no content changes.',
    });
    expect(diffBody(entry(renamed))).toEqual({
      kind: 'note',
      text: 'Renamed with unrelated content — diff omitted.',
    });
  });
});

describe('collapsing', () => {
  const off = { expanded: false, collapsed: false };

  it('collapses a large diff by default and lets a click override it', () => {
    const large = entry({ additions: COLLAPSE_LINE_THRESHOLD, deletions: 1 });
    expect(isDiffCollapsed(entry(), off)).toBe(false);
    expect(isDiffCollapsed(large, off)).toBe(true);
    expect(isDiffCollapsed(large, { expanded: true, collapsed: false })).toBe(false);
    expect(isDiffCollapsed(entry(), { expanded: false, collapsed: true })).toBe(true);
  });
});

describe('labels', () => {
  it('formats counts, paths and the summary', () => {
    expect(diffCounts(entry())).toBe('+2 −1');
    expect(diffCounts(entry({ binary: true }))).toBeNull();
    expect(diffPathLabel(entry({ renameSource: 'old.ts' }))).toBe('old.ts → src/a.ts');
    expect(diffSummary([])).toBe('The working tree is clean.');
    expect(diffSummary([entry(), entry({ path: 'b' })])).toBe('2 files · +4 −2');
    expect(diffSummary([entry()])).toBe('1 file · +2 −1');
  });
});
