import type {
  AgentTaskState,
  Issue,
  LogRow,
  Notification,
  ParkedQuestion,
  StoredNotification,
  TaskLogEntry,
} from '../types/index';

const RUNNING_STATUSES: AgentTaskState['status'][] = ['starting', 'running', 'stopping'];

/** The row a Stack panel task card links to: still in flight, or already rolled
 * into `tasks.log` under the same id by the time it's clicked. */
export function logRowIdForTask(task: AgentTaskState): string {
  return RUNNING_STATUSES.includes(task.status) ? `running:${task.id}` : `task:${task.id}`;
}

function entryCost(entry: TaskLogEntry): number | undefined {
  if (entry.usage) return entry.usage.costUsd;
  if (!entry.phaseRuns?.length) return undefined;
  return entry.phaseRuns.reduce((sum, phase) => sum + phase.usage.costUsd, 0);
}

function unreadCompletedIds(notifications: Notification[]): Set<string> {
  return new Set(
    notifications
      .filter((n): n is StoredNotification => n.kind === 'completed' && !n.read)
      .map((n) => n.id),
  );
}

function taskRow(entry: TaskLogEntry, unreadIds: Set<string>): LogRow {
  return {
    id: `task:${entry.id}`,
    timestamp: entry.endedAt,
    type: entry.taskKind,
    entityId: entry.planId,
    entityTitle: entry.planTitle,
    title: entry.planTitle,
    agentId: entry.agentId,
    durationMs: entry.usage?.durationMs,
    costUsd: entryCost(entry),
    outcome: entry.outcome,
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
    id: `question:${question.entityId}-${index}`,
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
