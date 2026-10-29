import { describe, expect, it } from 'vitest';
import type { PhaseItem, ResolvedNeed, ThreadMessage } from '../types/index';
import { batchReadiness } from './batch-readiness';

const phase = (overrides: Partial<PhaseItem>): PhaseItem => ({
  done: false,
  text: 'Do the thing',
  ...overrides,
});

const base = {
  phases: [phase({})] as PhaseItem[],
  staleBase: null,
  hasAgent: true,
};

describe('batchReadiness', () => {
  it('is ready when every check passes', () => {
    expect(batchReadiness(base)).toEqual({ ready: true });
  });

  it('reports a blocking need', () => {
    const resolvedNeeds: ResolvedNeed[] = [
      { raw: 'IDEA-1', id: 'IDEA-1', found: true, done: false },
    ];
    expect(batchReadiness({ ...base, resolvedNeeds })).toEqual({
      ready: false,
      reason: 'needs',
      message: 'waits for IDEA-1',
    });
  });

  it('includes the project name for a cross-project need', () => {
    const resolvedNeeds: ResolvedNeed[] = [
      {
        raw: 'other/IDEA-1',
        id: 'IDEA-1',
        projectSlug: 'other',
        projectName: 'Other',
        found: true,
        done: false,
      },
    ];
    expect(batchReadiness({ ...base, resolvedNeeds })).toEqual({
      ready: false,
      reason: 'needs',
      message: 'waits for Other IDEA-1',
    });
  });

  it('does not block on a need that cannot be resolved', () => {
    const resolvedNeeds: ResolvedNeed[] = [{ raw: 'IDEA-1', id: 'IDEA-1', found: false }];
    expect(batchReadiness({ ...base, resolvedNeeds })).toEqual({ ready: true });
  });

  it('does not block on an already-done need', () => {
    const resolvedNeeds: ResolvedNeed[] = [
      { raw: 'IDEA-1', id: 'IDEA-1', found: true, done: true },
    ];
    expect(batchReadiness({ ...base, resolvedNeeds })).toEqual({ ready: true });
  });

  it('reports only-manual phases left', () => {
    expect(batchReadiness({ ...base, phases: [phase({ source: 'manual' })] })).toEqual({
      ready: false,
      reason: 'manual-only',
      message: 'only manual steps left',
    });
  });

  it('reports only-manual when every phase and fix is already done', () => {
    expect(
      batchReadiness({ ...base, phases: [phase({ done: true })], fixes: [phase({ done: true })] }),
    ).toEqual({
      ready: false,
      reason: 'manual-only',
      message: 'only manual steps left',
    });
  });

  it('is ready when a fix carries the runnable work', () => {
    expect(
      batchReadiness({ ...base, phases: [phase({ done: true })], fixes: [phase({ done: false })] }),
    ).toEqual({ ready: true });
  });

  it('reports an open question', () => {
    const thread: ThreadMessage[] = [{ kind: 'question', text: 'Which option?', state: 'open' }];
    expect(batchReadiness({ ...base, thread })).toEqual({
      ready: false,
      reason: 'open-question',
      message: 'waiting on your answer',
    });
  });

  it('does not block on a resolved question', () => {
    const thread: ThreadMessage[] = [
      { kind: 'question', text: 'Which option?', state: 'resolved' },
    ];
    expect(batchReadiness({ ...base, thread })).toEqual({ ready: true });
  });

  it('reports a stale base', () => {
    expect(
      batchReadiness({ ...base, staleBase: 'IDEA-1 already has 2/3 phases complete on main.' }),
    ).toEqual({
      ready: false,
      reason: 'stale-base',
      message: 'IDEA-1 already has 2/3 phases complete on main.',
    });
  });

  it('reports no agent set up', () => {
    expect(batchReadiness({ ...base, hasAgent: false })).toEqual({
      ready: false,
      reason: 'no-agent',
      message: 'no agent set up',
    });
  });

  it('checks needs before manual-only', () => {
    const resolvedNeeds: ResolvedNeed[] = [
      { raw: 'IDEA-1', id: 'IDEA-1', found: true, done: false },
    ];
    expect(
      batchReadiness({ ...base, resolvedNeeds, phases: [phase({ source: 'manual' })] }),
    ).toMatchObject({ reason: 'needs' });
  });
});
