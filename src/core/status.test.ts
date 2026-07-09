import { describe, expect, it } from 'vitest';
import { deriveStatus } from './status';

const phase = (done: boolean) => ({ done, text: 'phase' });

describe('deriveStatus', () => {
  it('is idea when there are no phases', () => {
    expect(deriveStatus({ phases: [] }, false)).toBe('idea');
    expect(deriveStatus({ phases: [] }, true)).toBe('idea');
    expect(deriveStatus({ phases: [] }, undefined)).toBe('idea');
  });

  it('is planned when phases exist but no branch does', () => {
    expect(deriveStatus({ phases: [phase(false)] }, false)).toBe('planned');
  });

  it('is in-progress when a branch exists but phases are unchecked', () => {
    expect(deriveStatus({ phases: [phase(true), phase(false)] }, true)).toBe('in-progress');
  });

  it('is review when a branch exists and every phase is checked', () => {
    expect(deriveStatus({ phases: [phase(true), phase(true)] }, true)).toBe('review');
  });

  it('falls back to the stored override when git is unavailable', () => {
    expect(deriveStatus({ phases: [phase(false)], status: 'review' }, undefined)).toBe('review');
  });

  it('falls back to planned when git is unavailable and nothing is stored', () => {
    expect(deriveStatus({ phases: [phase(false)] }, undefined)).toBe('planned');
  });

  it('never derives dropped — always passes it through as stored', () => {
    expect(deriveStatus({ phases: [], status: 'dropped' }, true)).toBe('dropped');
    expect(deriveStatus({ phases: [phase(true)], status: 'dropped' }, false)).toBe('dropped');
  });

  it('never derives done — always passes it through as stored', () => {
    expect(deriveStatus({ phases: [phase(true)], status: 'done' }, true)).toBe('done');
  });

  it('passes note status through unchanged, ignoring phases and branch', () => {
    expect(deriveStatus({ kind: 'note', status: 'open', phases: [] }, true)).toBe('open');
    expect(deriveStatus({ kind: 'note', status: 'done', phases: [phase(true)] }, false)).toBe(
      'done',
    );
  });

  it('derives done when the live PR lookup says merged, even overriding a stale stored value', () => {
    expect(deriveStatus({ phases: [phase(true)], status: 'in-progress' }, true, true)).toBe('done');
    expect(deriveStatus({ phases: [phase(false)] }, true, true)).toBe('done');
  });

  it('falls back to a stored done when the PR lookup is unresolved', () => {
    expect(deriveStatus({ phases: [phase(true)], status: 'done' }, true, undefined)).toBe('done');
  });

  it('falls through to the rest of the ladder on a confirmed non-merge, correcting a stale stored done', () => {
    expect(deriveStatus({ phases: [phase(true)], status: 'done' }, true, false)).toBe('review');
    expect(deriveStatus({ phases: [phase(true), phase(false)], status: 'done' }, true, false)).toBe(
      'in-progress',
    );
  });

  it('dropped always wins over a merged PR lookup', () => {
    expect(deriveStatus({ phases: [phase(true)], status: 'dropped' }, true, true)).toBe('dropped');
  });
});
