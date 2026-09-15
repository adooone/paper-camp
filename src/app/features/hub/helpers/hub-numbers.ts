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
  loading: boolean;
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

/** The last `count` ISO weeks ending with the current one, oldest first — the chart
 *  keeps its full range so a quiet week reads as a gap, not as a missing column. */
export function lastIsoWeeks(count: number, now: Date = new Date()): string[] {
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - i * 7);
    weeks.push(isoWeekOf(day));
  }
  return weeks;
}

function isoWeekOf(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function sumHubNumbers(params: {
  totalCount: number;
  dataByUrl: Record<string, HubProjectData | null>;
  sevenDayFloorPct: number;
}): Omit<HubNumbers, 'loading'> {
  const { totalCount, dataByUrl, sevenDayFloorPct } = params;
  const reachable = Object.values(dataByUrl).filter(
    (data): data is HubProjectData => data !== null,
  );

  // The machine's windows are the machine's, so any reachable project reports them.
  const capacitySource = reachable.find(({ stats }) => stats.capacity)?.stats.capacity;
  const capacity: HubCapacityFigure | null = capacitySource
    ? {
        fiveHour: capacitySource.snapshot.unifiedWindows?.five_hour ?? null,
        sevenDay: capacitySource.snapshot.unifiedWindows?.seven_day ?? null,
        sevenDayFloorPct,
      }
    : null;

  const weekTotals = new Map<string, { total: number; failed: number }>();
  for (const { stats } of reachable) {
    for (const week of stats.tasksPerWeek.slice(-RUNS_WEEK_COUNT)) {
      const bucket = weekTotals.get(week.week) ?? { total: 0, failed: 0 };
      bucket.total += week.count ?? 0;
      // An older runtime's stats omit these two fields; unguarded they poison the sum.
      bucket.failed += week.failedCount ?? 0;
      weekTotals.set(week.week, bucket);
    }
  }
  const runsPerWeek: HubRunsWeek[] = lastIsoWeeks(RUNS_WEEK_COUNT).map((week) => ({
    week,
    ...(weekTotals.get(week) ?? { total: 0, failed: 0 }),
  }));

  let thisWeekCost = 0;
  let thisWeekTokens = 0;
  let lastWeekCost = 0;
  for (const { stats } of reachable) {
    const weeks = stats.usagePerWeek;
    const curr = weeks[weeks.length - 1];
    const prev = weeks[weeks.length - 2];
    if (curr) {
      thisWeekCost += curr.costUsd ?? 0;
      thisWeekTokens += (curr.inputTokens ?? 0) + (curr.outputTokens ?? 0);
    }
    if (prev) lastWeekCost += prev.costUsd ?? 0;
  }
  const changeVsLastWeekPct =
    lastWeekCost > 0 ? ((thisWeekCost - lastWeekCost) / lastWeekCost) * 100 : null;

  const openQuestions = reachable.reduce((sum, { stats }) => sum + (stats.openQuestions ?? 0), 0);

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
    nightPassCount += lastNight.passCount ?? 0;
    nightCostUsd += lastNight.costUsd ?? 0;
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
