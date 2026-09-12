import type {
  AgentTaskState,
  Issue,
  LogRow,
  Notification,
  ParkedQuestion,
  RunUsage,
  StoredNotification,
  TaskLogEntry,
} from '../types/index';

const RUNNING_STATUSES: AgentTaskState['status'][] = ['starting', 'running', 'stopping'];

/** The row a Stack panel task card links to: still in flight, or already rolled
 * into `tasks.log` under the same id by the time it's clicked. */
export function logRowIdForTask(task: AgentTaskState): string {
  return RUNNING_STATUSES.includes(task.status) ? `running:${task.id}` : `task:${task.id}`;
}

const EMPTY_USAGE: RunUsage = {
  durationMs: 0,
  numTurns: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  costUsd: 0,
};

/** A run-all/phase entry only carries `usage` once every phase has reported;
 * until then its cost and duration live in `phaseRuns` and must be summed. */
export function usageForEntry(entry: TaskLogEntry): RunUsage | undefined {
  if (entry.usage) return entry.usage;
  if (!entry.phaseRuns?.length) return undefined;
  return entry.phaseRuns.reduce<RunUsage>(
    (acc, phase) => ({
      durationMs: acc.durationMs + phase.usage.durationMs,
      numTurns: acc.numTurns + phase.usage.numTurns,
      model: phase.usage.model ?? acc.model,
      inputTokens: acc.inputTokens + phase.usage.inputTokens,
      outputTokens: acc.outputTokens + phase.usage.outputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + phase.usage.cacheCreationTokens,
      cacheReadTokens: acc.cacheReadTokens + phase.usage.cacheReadTokens,
      costUsd: acc.costUsd + phase.usage.costUsd,
    }),
    EMPTY_USAGE,
  );
}

/** The most recent tasks.log entry per plan that's still `interrupted` — a newer
 * `started` line on that plan becomes the newest entry, dropping it from this list. */
export function interruptedNotices(taskLog: TaskLogEntry[]): TaskLogEntry[] {
  const latestByPlan = new Map<string, TaskLogEntry>();
  for (const entry of taskLog) {
    if (!entry.planId) continue;
    const current = latestByPlan.get(entry.planId);
    if (!current || entry.startedAt > current.startedAt) latestByPlan.set(entry.planId, entry);
  }
  return [...latestByPlan.values()].filter((entry) => entry.outcome === 'interrupted');
}

function unreadCompletedIds(notifications: Notification[]): Set<string> {
  return new Set(
    notifications
      .filter((n): n is StoredNotification => n.kind === 'completed' && !n.read)
      .map((n) => n.id),
  );
}

function taskRow(entry: TaskLogEntry, unreadIds: Set<string>): LogRow {
  const usage = usageForEntry(entry);
  return {
    id: `task:${entry.id}`,
    timestamp: entry.endedAt ?? entry.startedAt,
    type: entry.taskKind,
    entityId: entry.planId,
    entityTitle: entry.planTitle,
    title: entry.planTitle,
    agentId: entry.agentId,
    durationMs: usage?.durationMs,
    costUsd: usage?.costUsd,
    outcome: entry.outcome ?? 'running',
    unread: unreadIds.has(entry.id),
    source: { kind: 'task', entry },
  };
}

function issueRow(issue: Issue): LogRow {
  return {
    id: `issue:${issue.id}`,
    timestamp: issue.occurredAt ?? new Date(0).toISOString(),
    type: issue.sourceKind,
    entityId: issue.entityId,
    entityTitle: issue.entityTitle,
    title: issue.title,
    outcome: 'open',
    source: { kind: 'issue', issue },
  };
}

function runningRow(task: AgentTaskState): LogRow {
  return {
    id: `running:${task.id}`,
    timestamp: task.startedAt,
    type: task.taskKind,
    entityId: task.planId,
    entityTitle: task.planTitle,
    title: task.planTitle,
    agentId: task.agentId,
    outcome: 'running',
    source: { kind: 'running', task },
  };
}

function replyRow(notification: StoredNotification): LogRow {
  return {
    id: `notification:${notification.id}`,
    timestamp: notification.date,
    type: 'reply',
    entityId: notification.entityId,
    entityTitle: notification.entityTitle,
    title: notification.text,
    outcome: 'done',
    unread: !notification.read,
    source: { kind: 'reply', notification },
  };
}

function questionRow(question: ParkedQuestion, index: number): LogRow {
  return {
    id: `question:${question.entityId}-${question.date ?? index}`,
    timestamp: question.date ?? new Date(0).toISOString(),
    type: 'question',
    entityId: question.entityId,
    entityTitle: question.entityTitle,
    title: question.text,
    outcome: 'open',
    unread: true,
    source: { kind: 'question', question },
  };
}

const byNewest = (a: LogRow, b: LogRow) => b.timestamp.localeCompare(a.timestamp);

const OPPOSITE_PREFIX: Record<string, string> = { task: 'running', running: 'task' };

/** A deep link (a push notification's `task:<id>`) can outrun the client: the task
 * may still show as `running:<id>` if it hasn't rolled into tasks.log yet. */
export function resolveLogRow(rows: LogRow[], entryId: string): LogRow | undefined {
  const direct = rows.find((row) => row.id === entryId);
  if (direct) return direct;
  const [prefix, ...rest] = entryId.split(':');
  const altPrefix = OPPOSITE_PREFIX[prefix];
  if (!altPrefix || rest.length === 0) return undefined;
  return rows.find((row) => row.id === `${altPrefix}:${rest.join(':')}`);
}

/** The one stream (IDEA-237): every `tasks.log` entry, plus failures with no run
 * behind them (an 'agent-run' issue is the same failure as its tasks.log 'error'
 * entry, so it's excluded here to avoid a duplicate row), plus tasks still in
 * flight — which sort above the rest regardless of their own timestamp. */
export function buildLogRows(
  taskLog: TaskLogEntry[],
  issues: Issue[],
  agentStatus: AgentTaskState[],
  notifications: Notification[],
): LogRow[] {
  const running = agentStatus
    .filter((task) => RUNNING_STATUSES.includes(task.status))
    .map(runningRow)
    .sort(byNewest);

  const unreadIds = unreadCompletedIds(notifications);
  const replies = notifications
    .filter((n): n is StoredNotification => n.kind === 'reply')
    .map(replyRow);
  const questions = notifications
    .filter((n): n is ParkedQuestion & { kind: 'question' } => n.kind === 'question')
    .map(questionRow);

  const settled = [
    ...taskLog.map((entry) => taskRow(entry, unreadIds)),
    ...issues.filter((issue) => issue.sourceKind !== 'agent-run').map(issueRow),
    ...replies,
    ...questions,
  ].sort(byNewest);

  return [...running, ...settled];
}
