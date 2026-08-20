import type { DeskCheckState, GitSyncFailure, Issue, PrInfo, TaskLogEntry } from '../types/index';

const issueId = (sourceKind: Issue['sourceKind'], sourceKey: string): string =>
  `${sourceKind}:${sourceKey}`;

/** A failed agent run (`outcome: 'error'` in tasks.log), keyed by the plan it ran
 * against so a repeat failure on the same plan continues one issue. Runs with no
 * `planId` (e.g. a batch task) key off their own task id instead. */
export function collectAgentRunIssues(taskLog: TaskLogEntry[]): Issue[] {
  return taskLog
    .filter((entry) => entry.outcome === 'error')
    .map((entry) => {
      const sourceKey = entry.planId ?? entry.id;
      return {
        id: issueId('agent-run', sourceKey),
        sourceKind: 'agent-run',
        sourceKey,
        entityId: entry.planId,
        entityTitle: entry.planTitle,
        title: `${entry.planTitle} — ${entry.taskKind} failed`,
        reason: entry.reason ?? 'The run ended in error with no reason recorded.',
        occurredAt: entry.endedAt,
        thread: [],
      };
    });
}

/** A red project check (Quality/Tests/Consistency — Docs keeps its own browse flow
 * and is excluded, same carve-out as `buildCheckFixes`), keyed by check name. */
export function collectCheckIssues(checks: DeskCheckState[]): Issue[] {
  return checks
    .filter((check) => check.status === 'fail')
    .map((check) => ({
      id: issueId('check', check.name),
      sourceKind: 'check',
      sourceKey: check.name,
      title: `"${check.name}" check is failing`,
      reason: `The command was \`${check.cmd}\`.`,
      output: check.output || undefined,
      occurredAt: check.lastRun ?? undefined,
      thread: [],
    }));
}

/** A PR review that requested changes, keyed by PR number + head sha so a fresh
 * push that gets re-reviewed continues the same issue rather than a new one. */
export function collectPrReviewIssues(
  entities: { id: string; title: string; pr?: PrInfo }[],
): Issue[] {
  return entities
    .filter((entity) => entity.pr?.reviewDecision === 'changes-requested')
    .map((entity) => {
      const pr = entity.pr as PrInfo;
      const sourceKey = `${pr.number}:${pr.headSha ?? 'unknown'}`;
      return {
        id: issueId('pr-review', sourceKey),
        sourceKind: 'pr-review',
        sourceKey,
        entityId: entity.id,
        entityTitle: entity.title,
        title: `${entity.title} — PR review requested changes`,
        reason: `PR #${pr.number} has unresolved change requests.`,
        thread: [],
      };
    });
}

/** A git rebase/sync failure on the currently checked-out branch, keyed by branch +
 * the ref it failed to reconcile against so a repeat failure of the same rebase
 * continues one issue. */
export function collectSyncIssues(
  failure: GitSyncFailure | undefined,
  branch: string,
  entity?: { id: string; title: string },
): Issue[] {
  if (!failure) return [];
  const sourceKey = `${branch}:${failure.conflictRef ?? failure.stage}`;
  return [
    {
      id: issueId('sync', sourceKey),
      sourceKind: 'sync',
      sourceKey,
      entityId: entity?.id,
      entityTitle: entity?.title,
      title: `${branch} failed to sync`,
      reason: failure.message,
      output: failure.conflictedFiles?.length
        ? `Conflicted files: ${failure.conflictedFiles.join(', ')}`
        : undefined,
      thread: [],
    },
  ];
}

/** Merges freshly-collected issues into the existing set, keyed by `id`: a repeat
 * failure of the same thing replaces that issue's title/reason/output in place,
 * preserving its position and its thread, instead of appending a duplicate. */
export function upsertIssues(existing: Issue[], fresh: Issue[]): Issue[] {
  const freshById = new Map(fresh.map((issue) => [issue.id, issue]));
  const merged = existing.map((issue) => {
    const next = freshById.get(issue.id);
    if (!next) return issue;
    freshById.delete(issue.id);
    return { ...next, thread: issue.thread };
  });
  return [...merged, ...freshById.values()];
}
