import type { HubMachine } from '@/app/services/hub-machines';
import type {
  EntityStatus,
  NightFindingSeverity,
  NightReportGroup,
  ProjectStats,
  RateLimitWindow,
} from '@/types/index';

export interface HubProjectData {
  stats: ProjectStats;
  nightGroups: NightReportGroup[];
}

export interface HubCapacityFigure {
  fiveHour: RateLimitWindow | null;
  sevenDay: RateLimitWindow | null;
  sevenDayFloorPct: number;
}

export interface HubRunsWeek {
  week: string;
  total: number;
  failed: number;
}

export interface HubSpendFigure {
  costUsd: number;
  tokens: number;
  changeVsLastWeekPct: number | null;
}

export interface HubNightFigure {
  passCount: number;
  costUsd: number;
  findingsBySeverity: Partial<Record<NightFindingSeverity, number>>;
}

export interface HubNumbers {
  reachableCount: number;
  totalCount: number;
  capacity: HubCapacityFigure | null;
  runsPerWeek: HubRunsWeek[];
  spend: HubSpendFigure;
  openQuestions: number;
  entitiesByStatus: Partial<Record<EntityStatus, number>>;
  lastNight: HubNightFigure;
}

const RUNS_WEEK_COUNT = 8;

/** A row counts toward the sums once its machine answers and the folder is
 * still there — a `waiting`/`loading`/`unreachable` machine or a `Missing`
 * row has nothing to read `/api/stats` from. */
export function reachableProjectRuntimeUrls(machines: HubMachine[]): string[] {
  const urls: string[] = [];
  for (const machine of machines) {
    if (machine.reach !== 'ready') continue;
    for (const project of machine.projects) {
      if (project.stamp.kind === 'missing') continue;
      urls.push(project.runtimeUrl);
    }
  }
  return urls;
}

export function sumHubNumbers(params: {
  totalCount: number;
  dataByUrl: Record<string, HubProjectData | null>;
  continueRuntimeUrl: string | null;
  continueFloorPct: number;
}): HubNumbers {
  const { totalCount, dataByUrl, continueRuntimeUrl, continueFloorPct } = params;
  const reachable = Object.values(dataByUrl).filter(
    (data): data is HubProjectData => data !== null,
  );

  const continueData = continueRuntimeUrl ? dataByUrl[continueRuntimeUrl] : null;
  const capacity: HubCapacityFigure | null = continueData?.stats.capacity
    ? {
        fiveHour: continueData.stats.capacity.snapshot.unifiedWindows?.five_hour ?? null,
        sevenDay: continueData.stats.capacity.snapshot.unifiedWindows?.seven_day ?? null,
        sevenDayFloorPct: continueFloorPct,
      }
    : null;

  const weekTotals = new Map<string, { total: number; failed: number }>();
  for (const { stats } of reachable) {
    for (const week of stats.tasksPerWeek.slice(-RUNS_WEEK_COUNT)) {
      const bucket = weekTotals.get(week.week) ?? { total: 0, failed: 0 };
      bucket.total += week.count;
      bucket.failed += week.failedCount;
      weekTotals.set(week.week, bucket);
    }
  }
  const runsPerWeek: HubRunsWeek[] = [...weekTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-RUNS_WEEK_COUNT)
    .map(([week, totals]) => ({ week, ...totals }));

  let thisWeekCost = 0;
  let thisWeekTokens = 0;
  let lastWeekCost = 0;
  for (const { stats } of reachable) {
    const weeks = stats.usagePerWeek;
    const curr = weeks[weeks.length - 1];
    const prev = weeks[weeks.length - 2];
    if (curr) {
      thisWeekCost += curr.costUsd;
      thisWeekTokens += curr.inputTokens + curr.outputTokens;
    }
    if (prev) lastWeekCost += prev.costUsd;
  }
  const changeVsLastWeekPct =
    lastWeekCost > 0 ? ((thisWeekCost - lastWeekCost) / lastWeekCost) * 100 : null;

  const openQuestions = reachable.reduce((sum, { stats }) => sum + stats.openQuestions, 0);

  const entitiesByStatus: Partial<Record<EntityStatus, number>> = {};
  for (const { stats } of reachable) {
    for (const [status, count] of Object.entries(stats.entitiesByStatus)) {
      const key = status as EntityStatus;
      entitiesByStatus[key] = (entitiesByStatus[key] ?? 0) + (count ?? 0);
    }
  }

  let nightPassCount = 0;
  let nightCostUsd = 0;
  const findingsBySeverity: Partial<Record<NightFindingSeverity, number>> = {};
  for (const { nightGroups } of reachable) {
    const lastNight = nightGroups[0];
    if (!lastNight) continue;
    nightPassCount += lastNight.passCount;
    nightCostUsd += lastNight.costUsd;
    for (const finding of lastNight.findings) {
      findingsBySeverity[finding.severity] = (findingsBySeverity[finding.severity] ?? 0) + 1;
    }
  }

  return {
    reachableCount: reachable.length,
    totalCount,
    capacity,
    runsPerWeek,
    spend: { costUsd: thisWeekCost, tokens: thisWeekTokens, changeVsLastWeekPct },
    openQuestions,
    entitiesByStatus,
    lastNight: { passCount: nightPassCount, costUsd: nightCostUsd, findingsBySeverity },
  };
}
