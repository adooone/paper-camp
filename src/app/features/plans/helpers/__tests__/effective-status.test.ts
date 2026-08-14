import type { AgentTaskState, PlanEntry, ThreadMessage } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  effectiveStatus,
  latestReviewNote,
  runningPrReviewForPlan,
  runningTaskForPlan,
} from '../helpers';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

const task = (overrides: Partial<AgentTaskState>): AgentTaskState => ({
  id: 't1',
  status: 'running',
  taskKind: 'phase',
  planTitle: 'Untitled',
  agentId: 'claude-code',
  lines: [],
  ...overrides,
});

describe('runningTaskForPlan', () => {
  it('finds a running task matching the plan id', () => {
    const tasks = [task({ planId: 'IDEA-1' })];
    expect(runningTaskForPlan('IDEA-1', tasks)).toBe(tasks[0]);
  });

  it('ignores done/error tasks and non-matching ids', () => {
    const tasks = [task({ planId: 'IDEA-1', status: 'done' }), task({ planId: 'IDEA-2' })];
    expect(runningTaskForPlan('IDEA-1', tasks)).toBeUndefined();
  });

  it('returns undefined without a plan id', () => {
    expect(runningTaskForPlan(undefined, [task({ planId: 'IDEA-1' })])).toBeUndefined();
  });
});

describe('runningPrReviewForPlan', () => {
  it('finds a running pr-review task matching the plan id', () => {
    const tasks = [task({ planId: 'IDEA-1', taskKind: 'pr-review' })];
    expect(runningPrReviewForPlan('IDEA-1', tasks)).toBe(tasks[0]);
  });

  it('ignores a running task of a different kind', () => {
    const tasks = [task({ planId: 'IDEA-1', taskKind: 'phase' })];
    expect(runningPrReviewForPlan('IDEA-1', tasks)).toBeUndefined();
  });

  it('ignores a done pr-review task', () => {
    const tasks = [task({ planId: 'IDEA-1', taskKind: 'pr-review', status: 'done' })];
    expect(runningPrReviewForPlan('IDEA-1', tasks)).toBeUndefined();
  });
});

describe('latestReviewNote', () => {
  const note = (overrides: Partial<ThreadMessage>): ThreadMessage => ({
    kind: 'log',
    text: '',
    ...overrides,
  });

  it('returns the most recent review-kind message', () => {
    const thread = [
      note({ kind: 'review', text: 'Comments · 1 finding — first pass' }),
      note({ kind: 'log', text: 'unrelated' }),
      note({ kind: 'review', text: 'Approves · 0 findings — looks good' }),
    ];
    expect(latestReviewNote(thread)).toBe('Approves · 0 findings — looks good');
  });

  it('returns undefined when no review message exists', () => {
    expect(latestReviewNote([note({ kind: 'log', text: 'unrelated' })])).toBeUndefined();
  });

  it('returns undefined for an empty or missing thread', () => {
    expect(latestReviewNote([])).toBeUndefined();
    expect(latestReviewNote(undefined)).toBeUndefined();
  });
});

describe('effectiveStatus', () => {
  it('overlays in-progress when a task is running for the plan', () => {
    const p = plan({ id: 'IDEA-1', status: 'planned' });
    expect(effectiveStatus(p, [task({ planId: 'IDEA-1' })])).toBe('in-progress');
  });

  it('leaves status untouched with no running task', () => {
    const p = plan({ id: 'IDEA-1', status: 'review' });
    expect(effectiveStatus(p, [])).toBe('review');
  });

  it('never overlays a terminal done/dropped status', () => {
    const done = plan({ id: 'IDEA-1', status: 'done' });
    const dropped = plan({ id: 'IDEA-2', status: 'dropped' });
    const tasks = [task({ planId: 'IDEA-1' }), task({ planId: 'IDEA-2', id: 't2' })];
    expect(effectiveStatus(done, tasks)).toBe('done');
    expect(effectiveStatus(dropped, tasks)).toBe('dropped');
  });
});
