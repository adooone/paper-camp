import { describe, expect, it } from 'vitest';
import type { PrInfo } from '../../types/index';
import { deriveStatus, isArchivable, isStatusFallback } from './status';

const phase = (done: boolean) => ({ done, text: 'phase' });
const pr = (state: PrInfo['state']): PrInfo => ({ number: 1, url: 'u', state });

describe('deriveStatus', () => {
  it('is idea when there are no phases', () => {
    expect(deriveStatus({ phases: [] }, undefined, true)).toBe('idea');
  });

  it('is planned when phases exist but there is no PR', () => {
    expect(deriveStatus({ phases: [phase(false)] }, undefined, true)).toBe('planned');
  });

  it('is in-progress when a PR is open/draft and phases are unchecked', () => {
    expect(deriveStatus({ phases: [phase(true), phase(false)] }, pr('open'), true)).toBe(
      'in-progress',
    );
    expect(deriveStatus({ phases: [phase(false)] }, pr('draft'), true)).toBe('in-progress');
  });

  it('is review when a PR is open/draft and every phase is checked', () => {
    expect(deriveStatus({ phases: [phase(true), phase(true)] }, pr('open'), true)).toBe('review');
    expect(deriveStatus({ phases: [phase(true)] }, pr('draft'), true)).toBe('review');
  });

  it('is in-progress when a PR is open and every phase is checked but a fix is open', () => {
    expect(
      deriveStatus({ phases: [phase(true)], fixes: [phase(true), phase(false)] }, pr('open'), true),
    ).toBe('in-progress');
  });

  it('is review when a PR is open, every phase is checked, and every fix is checked', () => {
    expect(deriveStatus({ phases: [phase(true)], fixes: [phase(true)] }, pr('open'), true)).toBe(
      'review',
    );
  });

  it('is done when the PR is merged and every phase is checked, even overriding a stale stored value', () => {
    expect(deriveStatus({ phases: [phase(true)], status: 'in-progress' }, pr('merged'), true)).toBe(
      'done',
    );
  });

  it('is planned when the PR is merged but a phase is unchecked, regardless of a stored done', () => {
    expect(
      deriveStatus({ phases: [phase(false)], status: 'in-progress' }, pr('merged'), true),
    ).toBe('planned');
    expect(deriveStatus({ phases: [phase(false)], status: 'done' }, pr('merged'), true)).toBe(
      'planned',
    );
  });

  it('reads a closed-unmerged PR as dropped', () => {
    expect(deriveStatus({ phases: [phase(true)] }, pr('closed'), true)).toBe('dropped');
  });

  it('falls back to the stored override when GitHub is unreachable', () => {
    expect(deriveStatus({ phases: [phase(false)], status: 'review' }, undefined, false)).toBe(
      'review',
    );
    expect(deriveStatus({ phases: [phase(true)], status: 'done' }, undefined, false)).toBe('done');
  });

  it('falls back to a phases-only guess when GitHub is unreachable and nothing is stored', () => {
    expect(deriveStatus({ phases: [phase(false)] }, undefined, false)).toBe('planned');
    expect(deriveStatus({ phases: [] }, undefined, false)).toBe('idea');
  });

  it('trusts a stored done when resolved but the entity has no matchable PR (legacy)', () => {
    expect(deriveStatus({ phases: [phase(true)], status: 'done' }, undefined, true)).toBe('done');
  });

  it('trusts a stored review when resolved but no branch or PR exists (direct-to-main)', () => {
    expect(deriveStatus({ phases: [phase(true)], status: 'review' }, undefined, true)).toBe(
      'review',
    );
  });

  it('is in-progress when main activity references the id but phases are unchecked', () => {
    expect(deriveStatus({ phases: [phase(false)] }, undefined, true, true)).toBe('in-progress');
  });

  it('is review when main activity references the id and every phase is checked', () => {
    expect(deriveStatus({ phases: [phase(true)] }, undefined, true, true)).toBe('review');
  });

  it('ignores main activity when there are no phases at all', () => {
    expect(deriveStatus({ phases: [] }, undefined, true, true)).toBe('idea');
  });

  it('ignores main activity when GitHub is unreachable, deferring to the stored/phase guess', () => {
    expect(deriveStatus({ phases: [phase(true)] }, undefined, false, true)).toBe('planned');
  });

  it('ignores main activity once a PR exists', () => {
    expect(deriveStatus({ phases: [phase(false)] }, pr('open'), true, true)).toBe('in-progress');
  });

  it('passes a stored dropped through, even over a merged PR', () => {
    expect(deriveStatus({ phases: [], status: 'dropped' }, undefined, true)).toBe('dropped');
    expect(deriveStatus({ phases: [phase(true)], status: 'dropped' }, pr('merged'), true)).toBe(
      'dropped',
    );
  });

  it('treats an archived entity as done, regardless of PR lookup state', () => {
    expect(deriveStatus({ phases: [phase(false)], archived: true }, undefined, false)).toBe('done');
    expect(deriveStatus({ phases: [], archived: true }, undefined, true)).toBe('done');
  });

  it('lets a stored dropped override an archived entity', () => {
    expect(deriveStatus({ phases: [], archived: true, status: 'dropped' }, undefined, true)).toBe(
      'dropped',
    );
  });

  it('passes note status through unchanged, ignoring phases and PR', () => {
    expect(deriveStatus({ kind: 'note', status: 'open', phases: [] }, pr('open'), true)).toBe(
      'open',
    );
    expect(
      deriveStatus({ kind: 'note', status: 'done', phases: [phase(true)] }, undefined, true),
    ).toBe('done');
  });
});

describe('isArchivable', () => {
  it('is true for a merged PR with review or done phases', () => {
    expect(isArchivable({ phases: [phase(true)] }, pr('merged'))).toBe(true);
    expect(isArchivable({ phases: [phase(true)], status: 'done' }, pr('merged'))).toBe(true);
  });

  it('is false without a merged PR', () => {
    expect(isArchivable({ phases: [phase(true)] }, undefined)).toBe(false);
    expect(isArchivable({ phases: [phase(true)] }, pr('open'))).toBe(false);
    expect(isArchivable({ phases: [phase(true)] }, pr('closed'))).toBe(false);
  });

  it('is false for a note, even with a merged PR', () => {
    expect(isArchivable({ kind: 'note', phases: [] }, pr('merged'))).toBe(false);
  });

  it('is false once the file already lives in ideas/archive/', () => {
    expect(isArchivable({ phases: [phase(true)], archived: true }, pr('merged'))).toBe(false);
  });

  it('is false when a stored dropped wins over the merged PR', () => {
    expect(isArchivable({ phases: [phase(true)], status: 'dropped' }, pr('merged'))).toBe(false);
  });

  it('is false once a merged idea gains a new unchecked phase, even if stored as done', () => {
    expect(
      isArchivable({ phases: [phase(true), phase(false)], status: 'done' }, pr('merged')),
    ).toBe(false);
  });
});

describe('isStatusFallback', () => {
  it('is true when GitHub is unreachable and there is no PR', () => {
    expect(isStatusFallback({ phases: [phase(false)] }, undefined, false)).toBe(true);
    expect(isStatusFallback({ phases: [phase(false)], status: 'review' }, undefined, false)).toBe(
      true,
    );
  });

  it('is false once PR lookup resolves', () => {
    expect(isStatusFallback({ phases: [phase(false)] }, undefined, true)).toBe(false);
  });

  it('is false when a PR was found, even if lookup as a whole did not fully resolve', () => {
    expect(isStatusFallback({ phases: [phase(false)] }, pr('open'), false)).toBe(false);
  });

  it('is false for an archived entity — its status is derived, not guessed', () => {
    expect(isStatusFallback({ phases: [], archived: true }, undefined, false)).toBe(false);
  });

  it('is false for a stored dropped — it always wins regardless of PR lookup', () => {
    expect(isStatusFallback({ phases: [], status: 'dropped' }, undefined, false)).toBe(false);
  });

  it('is false for a note — notes never derive from PR state', () => {
    expect(isStatusFallback({ kind: 'note', phases: [] }, undefined, false)).toBe(false);
  });
});
