import { describe, expect, it } from 'vitest';
import type { PrInfo } from '../../types/index';
import { deriveStatus } from './status';

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

  it('is done when the PR is merged, even overriding a stale stored value', () => {
    expect(
      deriveStatus({ phases: [phase(false)], status: 'in-progress' }, pr('merged'), true),
    ).toBe('done');
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

  it('passes a stored dropped through, even over a merged PR', () => {
    expect(deriveStatus({ phases: [], status: 'dropped' }, undefined, true)).toBe('dropped');
    expect(deriveStatus({ phases: [phase(true)], status: 'dropped' }, pr('merged'), true)).toBe(
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
