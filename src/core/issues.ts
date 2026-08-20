import type {
  DeskCheckState,
  EntityStatus,
  GitSyncFailure,
  Issue,
  PhaseItem,
  PrInfo,
  TaskLogEntry,
  ThreadMessage,
} from '../types/index';

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
        status: 'open',
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
      status: 'open',
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
        status: 'open',
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
      status: 'open',
    },
  ];
}

/** Reconciles freshly-collected issues (every one currently detected as failing, so
 * always 'open') against the existing set, keyed by `id`. A repeat failure of the
 * same thing replaces that issue's title/reason/output in place, preserving its
 * position and its thread. An existing issue absent from `fresh` has stopped
 * failing, so it closes — unless it was promoted to a fix entity that hasn't
 * shipped yet (`fixEntityStatus` reports its status), which keeps it open until
 * that entity reaches 'done'. Closure is derived here, never a mark-read button. */
export function reconcileIssues(
  existing: Issue[],
  fresh: Issue[],
  fixEntityStatus: (fixId: string) => EntityStatus | undefined = () => undefined,
): Issue[] {
  const freshById = new Map(fresh.map((issue) => [issue.id, issue]));
  const merged = existing.map((issue): Issue => {
    if (issue.promotedFixId && fixEntityStatus(issue.promotedFixId) === 'done') {
      freshById.delete(issue.id);
      return { ...issue, status: 'closed' };
    }
    const next = freshById.get(issue.id);
    if (!next) return { ...issue, status: 'closed' };
    freshById.delete(issue.id);
    return { ...next, thread: issue.thread, promotedFixId: issue.promotedFixId };
  });
  return [...merged, ...freshById.values()];
}

/** An entity Promote (IDEA-192 phase 6) may have created or amended — a spawned
 * fix/idea entity stamps `issueSource`; an open parent gets a `source: 'issue'`
 * item appended to its inline Fixes list instead. */
type PromotionTarget = {
  id?: string;
  status?: EntityStatus;
  issueSource?: string;
  fixes?: PhaseItem[];
};

/** Matches every issue against the corpus for a prior Promote (IDEA-192 phase 6),
 * re-derived from disk on every read since issues carry no store of their own —
 * the promotion survives a reload because git holds it, not a stored issue. Once
 * matched, an issue whose target has shipped (`status: 'done'`) closes, even if
 * its original source is still detected as failing. */
export function applyPromotions(issues: Issue[], entities: PromotionTarget[]): Issue[] {
  return issues
    .map((issue): Issue => {
      const spawned = entities.find((e) => e.issueSource === issue.id);
      if (spawned?.id) return { ...issue, promotedFixId: spawned.id };
      const parent = issue.entityId ? entities.find((e) => e.id === issue.entityId) : undefined;
      const appended = parent?.fixes?.some((f) => f.source === 'issue' && f.text === issue.title);
      return appended && parent?.id ? { ...issue, promotedFixId: parent.id } : issue;
    })
    .filter((issue) => {
      const target = issue.promotedFixId && entities.find((e) => e.id === issue.promotedFixId);
      return !(target && target.status === 'done');
    });
}

/** "Fix it here" (IDEA-192) launches an `issue-fix` task carrying the issue's id;
 * this reconstructs that issue's thread from every tasks.log entry carrying it,
 * oldest first, so a repeat fix attempt reads as a continuation, not a fresh mystery. */
export function issueThreadFromTaskLog(issue: Issue, taskLog: TaskLogEntry[]): ThreadMessage[] {
  return taskLog
    .filter((entry) => entry.issueId === issue.id)
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
    .map((entry) => ({
      kind: 'log',
      date: entry.endedAt.slice(0, 10),
      from: 'agent',
      text:
        entry.outcome === 'done'
          ? 'Ran a fix agent — finished.'
          : entry.outcome === 'error'
            ? `Ran a fix agent — failed: ${entry.reason ?? 'no reason recorded'}`
            : 'Ran a fix agent — superseded by a newer run.',
    }));
}
