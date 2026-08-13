import type { PhaseItem } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  appendManualPhase,
  isCorpusOnlyCommit,
  planEntityPath,
  stripCommitPrefix,
} from '../manual-commit';

describe('stripCommitPrefix', () => {
  it('strips a conventional-commit type(scope): prefix', () => {
    expect(stripCommitPrefix('fix(app): Smaller toolbar button text')).toBe(
      'Smaller toolbar button text',
    );
  });

  it('leaves a title with no prefix untouched', () => {
    expect(stripCommitPrefix('Smaller toolbar button text')).toBe('Smaller toolbar button text');
  });
});

describe('appendManualPhase', () => {
  it('appends a done, source: manual phase built from the stripped title', () => {
    const phases: PhaseItem[] = [{ done: true, text: 'First phase' }];
    expect(appendManualPhase(phases, 'fix(app): Smaller toolbar button text')).toEqual([
      { done: true, text: 'First phase' },
      { done: true, text: 'Smaller toolbar button text', source: 'manual' },
    ]);
  });

  it('does not mutate the existing phases array', () => {
    const phases: PhaseItem[] = [{ done: true, text: 'First phase' }];
    appendManualPhase(phases, 'feat(core): Add a thing');
    expect(phases).toEqual([{ done: true, text: 'First phase' }]);
  });
});

describe('isCorpusOnlyCommit', () => {
  it('is true when every path is under papercamp/', () => {
    expect(isCorpusOnlyCommit(['papercamp/ideas/IDEA-1.md', 'papercamp/ideas/index.md'])).toBe(
      true,
    );
  });

  it('is false when any path is real work', () => {
    expect(isCorpusOnlyCommit(['papercamp/ideas/IDEA-1.md', 'src/app/router.tsx'])).toBe(false);
  });

  it('is false for an empty list rather than claiming corpus-only', () => {
    expect(isCorpusOnlyCommit([])).toBe(false);
  });

  it('does not treat a lookalike prefix as the corpus', () => {
    expect(isCorpusOnlyCommit(['papercamp-docs/notes.md'])).toBe(false);
  });
});

describe('planEntityPath', () => {
  it('builds the entity file path the commit has to include', () => {
    expect(planEntityPath('IDEA-151')).toBe('papercamp/ideas/IDEA-151.md');
  });
});
