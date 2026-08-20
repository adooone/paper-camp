import { describe, expect, it } from 'vitest';
import type { DeskCheckState, GitSyncFailure, Issue, PrInfo, TaskLogEntry } from '../types/index';
import {
  collectAgentRunIssues,
  collectCheckIssues,
  collectPrReviewIssues,
  collectSyncIssues,
  upsertIssues,
} from './issues';

const taskLogEntry = (overrides: Partial<TaskLogEntry> = {}): TaskLogEntry => ({
  id: 'task-1',
  taskKind: 'phase',
  planId: 'IDEA-1',
  planTitle: 'First idea',
  agentId: 'claude-code',
  startedAt: '2026-08-01T00:00:00.000Z',
  endedAt: '2026-08-01T00:05:00.000Z',
  outcome: 'error',
  reason: 'agent crashed',
  ...overrides,
});

const deskCheck = (overrides: Partial<DeskCheckState> = {}): DeskCheckState => ({
  name: 'lint',
  cmd: 'pnpm lint',
  status: 'fail',
  lastRun: '2026-08-01T00:00:00.000Z',
  output: 'error: unused variable',
  ...overrides,
});

const prInfo = (overrides: Partial<PrInfo> = {}): PrInfo => ({
  number: 42,
  url: 'https://github.com/o/r/pull/42',
  state: 'open',
  reviewDecision: 'changes-requested',
  headSha: 'abc123',
  ...overrides,
});

const syncFailure = (overrides: Partial<GitSyncFailure> = {}): GitSyncFailure => ({
  ok: false,
  stage: 'conflicted',
  message: 'rebase failed',
  stashPending: false,
  conflictRef: 'origin/main',
  conflictedFiles: ['src/a.ts'],
  recoveryPrompt: 'recover',
  ...overrides,
});

describe('collectAgentRunIssues', () => {
  it('collects only error outcomes, keyed by planId', () => {
    const issues = collectAgentRunIssues([taskLogEntry(), taskLogEntry({ outcome: 'done' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 'agent-run:IDEA-1',
      sourceKind: 'agent-run',
      sourceKey: 'IDEA-1',
      entityId: 'IDEA-1',
      reason: 'agent crashed',
    });
  });

  it('falls back to the task id when there is no planId', () => {
    const issues = collectAgentRunIssues([taskLogEntry({ planId: undefined, id: 'task-9' })]);
    expect(issues[0].id).toBe('agent-run:task-9');
  });

  it('reports a default reason when none was recorded', () => {
    const issues = collectAgentRunIssues([taskLogEntry({ reason: undefined })]);
    expect(issues[0].reason).toBe('The run ended in error with no reason recorded.');
  });
});

describe('collectCheckIssues', () => {
  it('collects only failing checks, keyed by name', () => {
    const issues = collectCheckIssues([deskCheck(), deskCheck({ name: 'test', status: 'pass' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 'check:lint',
      sourceKind: 'check',
      sourceKey: 'lint',
      output: 'error: unused variable',
    });
  });
});

describe('collectPrReviewIssues', () => {
  it('collects only entities whose PR requested changes, keyed by PR number + headSha', () => {
    const issues = collectPrReviewIssues([
      { id: 'IDEA-1', title: 'First', pr: prInfo() },
      { id: 'IDEA-2', title: 'Second', pr: prInfo({ reviewDecision: 'approved' }) },
      { id: 'IDEA-3', title: 'Third' },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 'pr-review:42:abc123',
      entityId: 'IDEA-1',
    });
  });
});

describe('collectSyncIssues', () => {
  it('returns nothing when there is no failure', () => {
    expect(collectSyncIssues(undefined, 'feat/x')).toEqual([]);
  });

  it('keys by branch and the ref it failed to reconcile against', () => {
    const issues = collectSyncIssues(syncFailure(), 'feat/x', { id: 'IDEA-1', title: 'First' });
    expect(issues[0]).toMatchObject({
      id: 'sync:feat/x:origin/main',
      sourceKey: 'feat/x:origin/main',
      entityId: 'IDEA-1',
      output: 'Conflicted files: src/a.ts',
    });
  });
});

describe('upsertIssues', () => {
  it('replaces a repeat failure of the same source in place, preserving its thread', () => {
    const existing: Issue[] = [
      {
        id: 'check:lint',
        sourceKind: 'check',
        sourceKey: 'lint',
        title: 'old title',
        reason: 'old reason',
        thread: [{ kind: 'log', text: 'first attempt', from: 'agent' }],
      },
    ];
    const fresh = collectCheckIssues([deskCheck({ output: 'new failure output' })]);
    const merged = upsertIssues(existing, fresh);
    expect(merged).toHaveLength(1);
    expect(merged[0].output).toBe('new failure output');
    expect(merged[0].thread).toEqual(existing[0].thread);
  });

  it('appends a newly-failing source without disturbing existing positions', () => {
    const existing: Issue[] = [
      {
        id: 'check:lint',
        sourceKind: 'check',
        sourceKey: 'lint',
        title: 'lint failing',
        reason: 'reason',
        thread: [],
      },
    ];
    const fresh = [
      ...collectCheckIssues([deskCheck()]),
      ...collectCheckIssues([deskCheck({ name: 'test' })]),
    ];
    const merged = upsertIssues(existing, fresh);
    expect(merged.map((issue) => issue.id)).toEqual(['check:lint', 'check:test']);
  });

  it('leaves an existing issue in place when nothing fresh matches it — closure is derived elsewhere', () => {
    const existing: Issue[] = [
      {
        id: 'check:lint',
        sourceKind: 'check',
        sourceKey: 'lint',
        title: 'lint failing',
        reason: 'reason',
        thread: [],
      },
    ];
    const merged = upsertIssues(existing, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('check:lint');
  });
});
