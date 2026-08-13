import type { PhaseItem } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { appendManualPhase, stripCommitPrefix } from '../manual-commit';

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
