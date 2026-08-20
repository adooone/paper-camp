import { describe, expect, it } from 'vitest';
import { derivePurposeLine } from '../helpers';

describe('derivePurposeLine', () => {
  it('extracts the trimmed opening sentence from the body', () => {
    const body = 'A follow-up to a shipped idea becomes its own entity. Done ideas stay done.';
    expect(derivePurposeLine(body)).toBe('A follow-up to a shipped idea becomes its own entity.');
  });

  it('does not cut the sentence short on a dotted token with no trailing space', () => {
    const body =
      '`papercamp/plans/plan-list-selector.ts` builds the worklist row from the title. It skips the rest.';
    expect(derivePurposeLine(body)).toBe(
      '`papercamp/plans/plan-list-selector.ts` builds the worklist row from the title.',
    );
  });

  it('collapses internal newlines and repeated whitespace into single spaces', () => {
    const body = 'The worklist carries a whole\nparent/child rendering path that cannot execute.';
    expect(derivePurposeLine(body)).toBe(
      'The worklist carries a whole parent/child rendering path that cannot execute.',
    );
  });

  it('falls back to the whole normalized body when there is no terminal punctuation', () => {
    expect(derivePurposeLine('No punctuation here')).toBe('No punctuation here');
  });

  it('returns an empty string for an empty or blank body', () => {
    expect(derivePurposeLine('')).toBe('');
    expect(derivePurposeLine('   \n  ')).toBe('');
  });
});
