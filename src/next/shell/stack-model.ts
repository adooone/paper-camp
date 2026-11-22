import { draftPrSecretsMissing, versionLine } from '@/app/components/stack-panel/ci-group';
import { formatLastRun } from '@/app/components/stack-panel/shared';
import type { DeskDiff } from '@/app/features/settings/helpers';
import type { BatchRunState } from '@/core/batch-run';
import { ciRunWord } from '@/core/ci/ci-run-word';
import { logRowIdForTask } from '@/core/run-rows';
import type { ServiceTone } from '@/core/service-status';
import {
  AGENT_LABELS,
  type AgentTaskState,
  type AgentTaskStatus,
  type CiReleaseState,
  type CiRun,
  type CiRunStatus,
  type TaskLogEntry,
} from '@/types/index';
import type { StampMeaning } from '../ui/stamp';
import { SCREEN_PATHS } from './screens';

const LIVE_STATUSES: readonly AgentTaskStatus[] = ['starting', 'running', 'stopping'];

const isLive = (task: AgentTaskState): boolean => LIVE_STATUSES.includes(task.status);

const TASK_MEANING: Record<AgentTaskStatus, StampMeaning> = {
  starting: 'running',
  running: 'running',
  stopping: 'running',
  done: 'done',
  error: 'failed',
  superseded: 'parked',
};

export interface TaskCardView {
  title: string;
  meta: string;
  stamp: { meaning: StampMeaning; label: string };
  signedOut: boolean;
  live: boolean;
  stopping: boolean;
}

export const taskCardView = (task: AgentTaskState, title: string): TaskCardView => {
  const signedOut = task.status === 'error' && task.errorKind === 'auth';
  return {
    title,
    meta: `${AGENT_LABELS[task.agentId]} · ${formatLastRun(task.startedAt)}`,
    stamp: signedOut
      ? { meaning: 'failed', label: 'stopped — agent signed out' }
      : { meaning: TASK_MEANING[task.status], label: task.status },
    signedOut,
    live: isLive(task),
    stopping: task.status === 'stopping',
  };
};

export const taskTarget = (task: AgentTaskState): string =>
  task.taskKind === 'chat'
    ? SCREEN_PATHS.chat
    : `${SCREEN_PATHS.log}/${encodeURIComponent(logRowIdForTask(task))}`;

export const noticeTarget = (entry: TaskLogEntry): string =>
  `${SCREEN_PATHS.log}/${encodeURIComponent(`task:${entry.id}`)}`;

const PAUSE_LABELS: Record<string, string> = {
  'capacity-ceiling': 'waiting for the 5h reset',
  'capacity-floor': '7d floor exceeded',
  'failed-dirty': 'failed, tree dirty',
  'red-checks': 'checks red',
  auth: 'signed out',
  conflict: 'conflict',
};

export interface QueueCardView {
  title: string;
  line: string;
  stamp: { meaning: StampMeaning; label: string };
  canStop: boolean;
  canDismiss: boolean;
}

const QUEUE_MEANING: Record<BatchRunState['status'], StampMeaning> = {
  running: 'running',
  paused: 'failed',
  interrupted: 'parked',
  done: 'done',
};

export const queueCardView = (
  batch: BatchRunState,
  lastLine: string | undefined,
  agentLabel: string,
): QueueCardView => {
  const total = batch.initialIds.length;
  const finished = batch.items.filter(
    (item) => item.outcome !== 'queued' && item.outcome !== 'running',
  ).length;
  const running = batch.items.find((item) => item.outcome === 'running');
  const terminal = batch.status === 'done';
  return {
    title: `Run queue — ${finished}/${total}`,
    line: terminal
      ? `${batch.ideasRun} idea(s) run`
      : running
        ? `${running.id} — ${lastLine ?? agentLabel}`
        : 'queued',
    stamp: {
      meaning: QUEUE_MEANING[batch.status],
      label:
        batch.status === 'paused' && batch.pause
          ? (PAUSE_LABELS[batch.pause.kind] ?? 'paused')
          : batch.status,
    },
    canStop: batch.status === 'running',
    canDismiss: terminal,
  };
};

export const showQueueCard = (batch: BatchRunState | null | undefined, dismissed: boolean) =>
  Boolean(batch && !(batch.status === 'done' && dismissed));

const RUN_TONE: Record<CiRunStatus, ServiceTone> = {
  success: 'pass',
  failure: 'fail',
  in_progress: 'running',
  queued: 'running',
  cancelled: 'muted',
  unknown: 'muted',
};

const runTone = (status: CiRunStatus): ServiceTone => RUN_TONE[status];

interface CiLine {
  name: string;
  word: string;
  tone: ServiceTone;
  href: string | null;
  tooltip?: string;
  opensSettings: boolean;
}

export type CiView =
  | { kind: 'none' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      lines: CiLine[];
      runsUnreadable: boolean;
      branch: string;
      version: string;
      releaseUrl: string | null;
    };

const runLine = (run: CiRun): CiLine => ({
  name: run.workflow,
  word: ciRunWord(run.status),
  tone: runTone(run.status),
  href: run.url,
  tooltip: run.failedJobs?.join(', '),
  opensSettings: false,
});

export const ciView = (ci: CiReleaseState | null): CiView => {
  if (!ci) return { kind: 'none' };
  if (!ci.available) return { kind: 'unavailable' };
  const lines = (ci.runs ?? []).map(runLine);
  if (ci.draftPr && draftPrSecretsMissing(ci.draftPr)) {
    lines.push({
      name: ci.draftPr.lastRun?.workflow ?? 'Draft PR',
      word: 'secrets missing',
      tone: 'fail',
      href: null,
      opensSettings: true,
    });
  } else if (ci.draftPr?.lastRun) {
    lines.push(runLine(ci.draftPr.lastRun));
  }
  return {
    kind: 'ready',
    lines,
    runsUnreadable: ci.runs === null,
    branch: ci.branch,
    version: versionLine(ci),
    releaseUrl: ci.releasePr?.url ?? null,
  };
};

export interface DeskChangeLine {
  key: string;
  mark: '+' | '−' | '~';
  area: 'service' | 'check' | 'ci';
  text: string;
}

const CHANGE_MARK = { added: '+', removed: '−', changed: '~' } as const;

export const deskChangeLines = (diff: DeskDiff): DeskChangeLine[] => [
  ...diff.services.map((change) => {
    const service = 'service' in change ? change.service : change.after;
    return {
      key: `service:${service.cmd}`,
      mark: CHANGE_MARK[change.kind],
      area: 'service' as const,
      text: `${service.name} — ${service.cmd}`,
    };
  }),
  ...diff.checks.map((change) => {
    const check = 'check' in change ? change.check : change.after;
    return {
      key: `check:${check.cmd}`,
      mark: CHANGE_MARK[change.kind],
      area: 'check' as const,
      text: `${check.name} — ${check.cmd}`,
    };
  }),
  ...(diff.ci
    ? [
        {
          key: 'ci',
          mark: CHANGE_MARK[diff.ci.kind],
          area: 'ci' as const,
          text: ('ci' in diff.ci ? diff.ci.ci : diff.ci.after).repo,
        },
      ]
    : []),
];
