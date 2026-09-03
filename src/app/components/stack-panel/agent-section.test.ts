import type { AgentTaskState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { taskCardTitle, taskKindLabel, taskSubtitle } from './agent-section';

const task = (overrides: Partial<AgentTaskState> = {}): AgentTaskState => ({
  id: 't1',
  status: 'running',
  taskKind: 'phase',
  planTitle: 'Untitled',
  startedAt: '2024-01-01T00:00:00.000Z',
  agentId: 'claude-code',
  lines: [],
  ...overrides,
});

describe('taskKindLabel', () => {
  it('numbers the phase from the zero-based phaseIndex', () => {
    expect(taskKindLabel(task({ taskKind: 'phase', phaseIndex: 1 }))).toBe('phase 2');
  });

  it('is empty for a phase task with no phaseIndex yet', () => {
    expect(taskKindLabel(task({ taskKind: 'phase', phaseIndex: undefined }))).toBe('');
  });

  it('labels batch-reconcile in lowercase', () => {
    expect(taskKindLabel(task({ taskKind: 'batch-reconcile' }))).toBe('batch reconcile');
  });

  it('includes the PR number when reviewing a known PR', () => {
    expect(
      taskKindLabel(task({ taskKind: 'pr-review', prReviewUrl: 'https://github.com/o/r/pull/42' })),
    ).toBe('reviewing PR #42');
  });

  it('falls back to a generic label when the PR number is unknown', () => {
    expect(taskKindLabel(task({ taskKind: 'pr-review', prReviewUrl: undefined }))).toBe(
      'reviewing PR',
    );
  });
});

describe('taskSubtitle', () => {
  it('drops the subtitle when the kind label restates the plan title', () => {
    expect(taskSubtitle(task({ taskKind: 'batch-reconcile', planTitle: 'Batch reconcile' }))).toBe(
      '',
    );
  });

  it('drops the subtitle case-insensitively', () => {
    expect(taskSubtitle(task({ taskKind: 'batch-reconcile', planTitle: 'BATCH RECONCILE' }))).toBe(
      '',
    );
  });

  it('keeps a distinct subtitle, prefixed with an em dash', () => {
    expect(
      taskSubtitle(task({ taskKind: 'phase', phaseIndex: 1, planTitle: 'Some other plan' })),
    ).toBe(' — phase 2');
  });

  it('is empty when the kind has no label at all', () => {
    expect(taskSubtitle(task({ taskKind: 'phase', phaseIndex: undefined }))).toBe('');
  });
});

describe('taskCardTitle', () => {
  it('names the kind and the entity, not the plan title', () => {
    expect(taskCardTitle(task({ taskKind: 'run-all', planId: 'IDEA-123' }))).toBe(
      'Phases: IDEA-123',
    );
    expect(taskCardTitle(task({ taskKind: 'commit-suggest', planId: 'IDEA-321' }))).toBe(
      'Commit: IDEA-321',
    );
  });

  it('numbers a single phase', () => {
    expect(taskCardTitle(task({ taskKind: 'phase', phaseIndex: 2, planId: 'IDEA-7' }))).toBe(
      'Phase 3: IDEA-7',
    );
  });

  it('falls back to the kind alone when the task carries no entity id', () => {
    expect(
      taskCardTitle(task({ taskKind: 'commit-suggest', planTitle: 'Suggest commit message' })),
    ).toBe('Commit');
  });
});
