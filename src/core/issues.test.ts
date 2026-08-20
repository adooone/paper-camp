import { describe, expect, it } from 'vitest';
import type { DeskCheckState, GitSyncFailure, Issue, PrInfo, TaskLogEntry } from '../types/index';
import {
  applyPromotions,
  collectAgentRunIssues,
  collectCheckIssues,
  collectPrReviewIssues,
  collectSyncIssues,
  issueThreadFromTaskLog,
  reconcileIssues,
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

const existingIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'check:lint',
  sourceKind: 'check',
  sourceKey: 'lint',
  title: 'lint failing',
  reason: 'reason',
  thread: [],
  status: 'open',
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

describe('reconcileIssues', () => {
  it('replaces a repeat failure of the same source in place, preserving its thread and status open', () => {
    const existing = [
      existingIssue({
        title: 'old title',
        reason: 'old reason',
        thread: [{ kind: 'log', text: 'first attempt', from: 'agent' }],
      }),
    ];
    const fresh = collectCheckIssues([deskCheck({ output: 'new failure output' })]);
    const merged = reconcileIssues(existing, fresh);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ output: 'new failure output', status: 'open' });
    expect(merged[0].thread).toEqual(existing[0].thread);
  });

  it('appends a newly-failing source without disturbing existing positions', () => {
    const existing = [existingIssue()];
    const fresh = [
      ...collectCheckIssues([deskCheck()]),
      ...collectCheckIssues([deskCheck({ name: 'test' })]),
    ];
    const merged = reconcileIssues(existing, fresh);
    expect(merged.map((issue) => issue.id)).toEqual(['check:lint', 'check:test']);
  });

  it('closes an issue whose check went green — absent from the fresh collection', () => {
    const existing = [existingIssue({ status: 'open' })];
    const merged = reconcileIssues(existing, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 'check:lint', status: 'closed' });
  });

  it('reopens a previously-closed issue when the same source fails again', () => {
    const existing = [existingIssue({ status: 'closed' })];
    const fresh = collectCheckIssues([deskCheck()]);
    const merged = reconcileIssues(existing, fresh);
    expect(merged[0].status).toBe('open');
  });

  it('keeps a promoted issue open while its fix entity has not shipped, even if still failing', () => {
    const existing = [existingIssue({ promotedFixId: 'IDEA-200', status: 'open' })];
    const fresh = collectCheckIssues([deskCheck()]);
    const merged = reconcileIssues(existing, fresh, (id) =>
      id === 'IDEA-200' ? 'in-progress' : undefined,
    );
    expect(merged[0]).toMatchObject({ status: 'open', promotedFixId: 'IDEA-200' });
  });

  it('closes a promoted issue once its fix entity ships, even if still detected as failing', () => {
    const existing = [existingIssue({ promotedFixId: 'IDEA-200', status: 'open' })];
    const fresh = collectCheckIssues([deskCheck()]);
    const merged = reconcileIssues(existing, fresh, (id) =>
      id === 'IDEA-200' ? 'done' : undefined,
    );
    expect(merged[0]).toMatchObject({ status: 'closed', promotedFixId: 'IDEA-200' });
  });

  it('closes a promoted issue whose source resolved on its own, without waiting on the fix', () => {
    const existing = [existingIssue({ promotedFixId: 'IDEA-200', status: 'open' })];
    const merged = reconcileIssues(existing, [], (id) =>
      id === 'IDEA-200' ? 'in-progress' : undefined,
    );
    expect(merged[0]).toMatchObject({ status: 'closed', promotedFixId: 'IDEA-200' });
  });
});

describe('applyPromotions', () => {
  it('matches a spawned fix entity by its issueSource stamp', () => {
    const issues = [existingIssue({ id: 'check:lint' })];
    const entities = [
      { id: 'IDEA-200', issueSource: 'check:lint', status: 'in-progress' as const },
    ];
    const merged = applyPromotions(issues, entities);
    expect(merged[0]).toMatchObject({ promotedFixId: 'IDEA-200' });
  });

  it("matches an issue-sourced item appended to its parent's inline Fixes list", () => {
    const issues = [
      existingIssue({ id: 'check:lint', entityId: 'IDEA-5', title: '"lint" check is failing' }),
    ];
    const entities = [
      {
        id: 'IDEA-5',
        status: 'in-progress' as const,
        fixes: [{ done: false, text: '"lint" check is failing', source: 'issue' as const }],
      },
    ];
    const merged = applyPromotions(issues, entities);
    expect(merged[0]).toMatchObject({ promotedFixId: 'IDEA-5' });
  });

  it('leaves an issue unmatched when nothing points back at it', () => {
    const issues = [existingIssue({ id: 'check:lint' })];
    const entities = [{ id: 'IDEA-200', status: 'in-progress' as const }];
    const merged = applyPromotions(issues, entities);
    expect(merged[0].promotedFixId).toBeUndefined();
  });

  it('closes an issue once its promoted target ships', () => {
    const issues = [existingIssue({ id: 'check:lint' })];
    const entities = [{ id: 'IDEA-200', issueSource: 'check:lint', status: 'done' as const }];
    const merged = applyPromotions(issues, entities);
    expect(merged).toHaveLength(0);
  });

  it('keeps a promoted issue open while its target has not shipped', () => {
    const issues = [existingIssue({ id: 'check:lint' })];
    const entities = [
      { id: 'IDEA-200', issueSource: 'check:lint', status: 'in-progress' as const },
    ];
    const merged = applyPromotions(issues, entities);
    expect(merged).toHaveLength(1);
    expect(merged[0].promotedFixId).toBe('IDEA-200');
  });
});

describe('issueThreadFromTaskLog', () => {
  it('ignores task log entries for other issues', () => {
    const issue = existingIssue({ id: 'check:lint' });
    const entries = [taskLogEntry({ issueId: 'check:test', outcome: 'done' })];
    expect(issueThreadFromTaskLog(issue, entries)).toEqual([]);
  });

  it('reports a successful fix attempt', () => {
    const issue = existingIssue({ id: 'check:lint' });
    const entries = [taskLogEntry({ issueId: 'check:lint', outcome: 'done', reason: undefined })];
    expect(issueThreadFromTaskLog(issue, entries)).toEqual([
      { kind: 'log', date: '2026-08-01', from: 'agent', text: 'Ran a fix agent — finished.' },
    ]);
  });

  it('carries the reason forward on a failed fix attempt', () => {
    const issue = existingIssue({ id: 'check:lint' });
    const entries = [
      taskLogEntry({ issueId: 'check:lint', outcome: 'error', reason: 'still red' }),
    ];
    expect(issueThreadFromTaskLog(issue, entries)[0]).toMatchObject({
      text: 'Ran a fix agent — failed: still red',
    });
  });

  it('orders repeat attempts oldest first, so a second failure reads as a continuation', () => {
    const issue = existingIssue({ id: 'check:lint' });
    const entries = [
      taskLogEntry({
        issueId: 'check:lint',
        outcome: 'error',
        endedAt: '2026-08-02T00:00:00.000Z',
      }),
      taskLogEntry({
        issueId: 'check:lint',
        outcome: 'error',
        endedAt: '2026-08-01T00:00:00.000Z',
      }),
    ];
    const thread = issueThreadFromTaskLog(issue, entries);
    expect(thread.map((m) => m.date)).toEqual(['2026-08-01', '2026-08-02']);
  });
});
