import { formatDuration, formatTokens } from '@/core/phase-run';
import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import type { EntityStatus, ProjectStats, RateLimitWindowKey } from '@/types/index';
import type { StampMeaning } from '../ui/stamp';

export interface StatLine {
  label: string;
  value: string;
  detail?: string;
  meaning?: StampMeaning;
}

export interface StatTile {
  key: string;
  title: string;
  figure?: string;
  figureLabel?: string;
  lines: StatLine[];
  empty?: string;
  stamp?: { label: string; meaning: StampMeaning };
}

const STATUS_ORDER: EntityStatus[] = [
  'open',
  'idea',
  'planned',
  'in-progress',
  'review',
  'done',
  'dropped',
];

const STATUS_LABEL: Record<EntityStatus, string> = {
  open: 'Open',
  idea: 'Idea',
  planned: 'Planned',
  'in-progress': 'In progress',
  review: 'Review',
  done: 'Done',
  dropped: 'Dropped',
};

const WINDOWS: { key: RateLimitWindowKey; label: string }[] = [
  { key: 'five_hour', label: '5-hour limit' },
  { key: 'seven_day', label: 'Weekly' },
];

const CAPACITY_MEANING: Record<ReturnType<typeof capacityLevel>, StampMeaning> = {
  allowed: 'done',
  warning: 'parked',
  rejected: 'failed',
};

const percent = (value: number): string => `${Math.round(value)}%`;

export const healthMeaning = (score: number): StampMeaning => {
  if (score >= 67) return 'failed';
  if (score >= 34) return 'parked';
  return 'done';
};

const chunkSignals = (chunk: ProjectStats['nightHealth']['chunks'][number]): string => {
  const { churnCommits, lines, coveragePct } = chunk.signals;
  const coverage = coveragePct === null ? 'coverage unknown' : `${percent(coveragePct)} covered`;
  const reviewed = chunk.lastReviewedAt
    ? `reviewed ${new Date(chunk.lastReviewedAt).toLocaleDateString()}`
    : 'never reviewed';
  return `${churnCommits} commits/30d · ${lines} lines · ${coverage} · ${reviewed}`;
};

const capacityTile = (capacity: ProjectStats['capacity']): StatTile => {
  if (capacity === null) {
    return {
      key: 'capacity',
      title: 'Claude capacity',
      lines: [],
      empty: 'No agent run has reported capacity yet.',
    };
  }
  const lines = WINDOWS.flatMap(({ key, label }): StatLine[] => {
    const window = capacity.snapshot.unifiedWindows?.[key];
    if (!window) return [];
    const resets =
      window.resetsAt === undefined
        ? undefined
        : `resets ${new Date(resetsAtMs(window.resetsAt)).toLocaleTimeString()}`;
    return [{ label, value: percent(window.utilization * 100), detail: resets }];
  });
  return {
    key: 'capacity',
    title: 'Claude capacity',
    stamp: {
      label: capacity.snapshot.overage
        ? `${capacity.snapshot.status} · overage`
        : capacity.snapshot.status,
      meaning: CAPACITY_MEANING[capacityLevel(capacity.snapshot.status)],
    },
    lines,
  };
};

export function statTiles(stats: ProjectStats): StatTile[] {
  const statuses = STATUS_ORDER.filter((status) => stats.entitiesByStatus[status]);
  return [
    {
      key: 'coverage',
      title: 'Test coverage',
      figure: stats.testCoveragePct === null ? '—' : percent(stats.testCoveragePct),
      figureLabel: 'line coverage',
      lines: [],
      empty:
        stats.testCoveragePct === null
          ? 'Run `pnpm test` to generate a coverage report.'
          : undefined,
    },
    {
      key: 'comments',
      title: 'Comment ratio',
      figure: percent(stats.comments.ratio * 100),
      figureLabel: 'of source lines',
      lines: [
        { label: 'Comment lines', value: String(stats.comments.commentLines) },
        { label: 'Source lines', value: String(stats.comments.sourceLines) },
      ],
    },
    {
      key: 'size',
      title: 'Codebase size',
      lines: [
        { label: 'Source lines', value: String(stats.comments.sourceLines) },
        { label: 'Test lines', value: String(stats.testLines) },
      ],
    },
    {
      key: 'status',
      title: 'Entities by status',
      lines: statuses.map((status) => ({
        label: STATUS_LABEL[status],
        value: String(stats.entitiesByStatus[status]),
      })),
      empty: statuses.length === 0 ? 'No entities yet.' : undefined,
    },
    {
      key: 'notes',
      title: 'Notes',
      lines: [
        { label: 'Open questions', value: String(stats.openQuestions) },
        { label: 'Decisions', value: String(stats.decisions) },
      ],
    },
    {
      key: 'median',
      title: 'Median phase duration',
      figure:
        stats.medianPhaseDurationMs === null ? '—' : formatDuration(stats.medianPhaseDurationMs),
      lines: [],
      empty: stats.medianPhaseDurationMs === null ? 'No phase runs recorded yet.' : undefined,
    },
    {
      key: 'tasks',
      title: 'Tasks per week',
      figure:
        stats.tasksPerWeek.length === 0
          ? undefined
          : String(stats.tasksPerWeek.reduce((sum, week) => sum + week.count, 0)),
      figureLabel: stats.tasksPerWeek.length === 0 ? undefined : 'runs in total',
      lines: stats.tasksPerWeek.map((week) => ({
        label: week.week,
        value: String(week.count),
        detail: week.failedCount > 0 ? `${week.failedCount} failed` : undefined,
      })),
      empty: stats.tasksPerWeek.length === 0 ? 'No tasks run yet.' : undefined,
    },
    {
      key: 'usage',
      title: 'Usage per week',
      lines: stats.usagePerWeek.map((week) => ({
        label: week.week,
        value: `${week.agentMinutes}m`,
        detail: `${formatTokens(week.inputTokens)} in · ${formatTokens(week.outputTokens)} out`,
      })),
      empty: stats.usagePerWeek.length === 0 ? 'No usage recorded yet.' : undefined,
    },
    {
      key: 'expensive',
      title: 'Most expensive ideas',
      lines: stats.mostExpensiveIdeas.map((idea) => ({
        label: idea.planId,
        value: `${formatTokens(idea.inputTokens)} in · ${formatTokens(idea.outputTokens)} out`,
        detail: idea.planTitle,
      })),
      empty: stats.mostExpensiveIdeas.length === 0 ? 'No usage recorded yet.' : undefined,
    },
    capacityTile(stats.capacity),
    {
      key: 'health',
      title: 'Code health',
      lines: stats.nightHealth.chunks.map((chunk) => ({
        label: chunk.path,
        value: String(chunk.score),
        meaning: healthMeaning(chunk.score),
        detail: chunkSignals(chunk),
      })),
      empty: stats.nightHealth.chunks.length === 0 ? 'No chunks found under src/.' : undefined,
    },
  ];
}
