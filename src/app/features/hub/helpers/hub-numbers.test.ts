import type { HubMachine, HubProjectRow } from '@/app/services/hub-machines';
import type { NightReportGroup, ProjectStats } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  type HubProjectData,
  lastIsoWeeks,
  reachableProjectRuntimeUrls,
  sumHubNumbers,
} from './hub-numbers';

function machine(overrides: Partial<HubMachine> = {}): HubMachine {
  return {
    machineUrl: 'http://host',
    host: 'host',
    reach: 'ready',
    runtimeVersion: null,
    versionMismatch: false,
    pendingUpdateVersion: null,
    projects: [],
    mostRecentActivity: null,
    ...overrides,
  };
}

function row(overrides: Partial<HubProjectRow> = {}): HubProjectRow {
  return {
    runtimeUrl: 'http://host/p/func-ui',
    slug: 'func-ui',
    packageName: null,
    stamp: { kind: 'idle' },
    lastOpenedAt: null,
    ...overrides,
  };
}

function stats(overrides: Partial<ProjectStats> = {}): ProjectStats {
  return {
    generatedAt: '2026-07-27T10:00:00Z',
    comments: { commentLines: 0, sourceLines: 0, ratio: 0 },
    testLines: 0,
    testCoveragePct: null,
    entitiesByStatus: {},
    openQuestions: 0,
    decisions: 0,
    tasksPerWeek: [],
    usagePerWeek: [],
    medianPhaseDurationMs: null,
    mostExpensiveIdeas: [],
    capacity: null,
    nightHealth: { generatedAt: '2026-07-27T10:00:00Z', chunks: [] },
    ...overrides,
  };
}

function projectData(overrides: Partial<HubProjectData> = {}): HubProjectData {
  return { stats: stats(), nightGroups: [], ...overrides };
}

describe('reachableProjectRuntimeUrls', () => {
  it('skips an unready machine and a missing row', () => {
    const machines = [
      machine({
        machineUrl: 'a',
        projects: [
          row({ runtimeUrl: 'a1' }),
          row({ runtimeUrl: 'a2', stamp: { kind: 'missing' } }),
        ],
      }),
      machine({
        machineUrl: 'b',
        reach: 'unreachable',
        projects: [row({ runtimeUrl: 'b1' })],
      }),
    ];
    expect(reachableProjectRuntimeUrls(machines)).toEqual(['a1']);
  });
});

describe('sumHubNumbers', () => {
  it('leaves an unreachable project out of every sum but counts it in the total', () => {
    const result = sumHubNumbers({
      totalCount: 2,
      dataByUrl: {
        a1: projectData({ stats: stats({ openQuestions: 3 }) }),
        a2: null,
      },
      sevenDayFloorPct: 70,
    });
    expect(result.reachableCount).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.openQuestions).toBe(3);
  });

  it('reads capacity off the first reachable project, marked with the night floor', () => {
    const result = sumHubNumbers({
      totalCount: 1,
      dataByUrl: {
        a1: projectData({
          stats: stats({
            capacity: {
              capturedAt: '2026-07-27T10:00:00Z',
              snapshot: {
                status: 'allowed',
                unifiedWindows: {
                  five_hour: { utilization: 0.4 },
                  seven_day: { utilization: 0.6 },
                },
              },
            },
          }),
        }),
      },
      sevenDayFloorPct: 70,
    });
    expect(result.capacity).toEqual({
      fiveHour: { utilization: 0.4 },
      sevenDay: { utilization: 0.6 },
      sevenDayFloorPct: 70,
    });
  });

  it('sums the last 8 weeks of runs across projects, keyed by week', () => {
    const week = lastIsoWeeks(3)[0];
    const result = sumHubNumbers({
      totalCount: 2,
      dataByUrl: {
        a1: projectData({ stats: stats({ tasksPerWeek: [{ week, count: 3, failedCount: 1 }] }) }),
        a2: projectData({ stats: stats({ tasksPerWeek: [{ week, count: 2, failedCount: 0 }] }) }),
      },
      sevenDayFloorPct: 70,
    });
    expect(result.runsPerWeek).toHaveLength(8);
    expect(result.runsPerWeek.find((entry) => entry.week === week)).toEqual({
      week,
      total: 5,
      failed: 1,
    });
  });

  it('drops a week older than the range and keeps the range full', () => {
    const weeks = lastIsoWeeks(8);
    const result = sumHubNumbers({
      totalCount: 1,
      dataByUrl: {
        a1: projectData({
          stats: stats({ tasksPerWeek: [{ week: weeks[7], count: 3, failedCount: 1 }] }),
        }),
      },
      sevenDayFloorPct: 70,
    });
    expect(result.runsPerWeek.map((week) => week.week)).toEqual(weeks);
    expect(result.runsPerWeek[7]).toEqual({ week: weeks[7], total: 3, failed: 1 });
    expect(result.runsPerWeek[0]).toEqual({ week: weeks[0], total: 0, failed: 0 });
  });

  it('tolerates a runtime whose stats omit failedCount and costUsd', () => {
    const result = sumHubNumbers({
      totalCount: 1,
      dataByUrl: {
        a1: projectData({
          stats: stats({
            tasksPerWeek: [{ week: lastIsoWeeks(1)[0], count: 4 } as never],
            usagePerWeek: [
              { week: lastIsoWeeks(1)[0], agentMinutes: 9, inputTokens: 10, outputTokens: 20 },
            ] as never,
          }),
        }),
      },
      sevenDayFloorPct: 70,
    });
    expect(result.runsPerWeek[7]).toEqual({ week: lastIsoWeeks(1)[0], total: 4, failed: 0 });
    expect(result.spend).toEqual({ costUsd: 0, tokens: 30, changeVsLastWeekPct: null });
  });

  it("takes this week and last week as each project's two most recent buckets", () => {
    const result = sumHubNumbers({
      totalCount: 1,
      dataByUrl: {
        a1: projectData({
          stats: stats({
            usagePerWeek: [
              { week: '2026-W29', agentMinutes: 0, inputTokens: 0, outputTokens: 0, costUsd: 4 },
              { week: '2026-W30', agentMinutes: 0, inputTokens: 100, outputTokens: 50, costUsd: 6 },
            ],
          }),
        }),
      },
      sevenDayFloorPct: 70,
    });
    expect(result.spend).toEqual({ costUsd: 6, tokens: 150, changeVsLastWeekPct: 50 });
  });

  it('tallies only the most recent night group per project, by severity', () => {
    const groups: NightReportGroup[] = [
      {
        date: '2026-07-27',
        passCount: 2,
        costUsd: 1.5,
        findings: [
          {
            date: '2026-07-27',
            check: 'c',
            chunk: 'x',
            file: 'a.ts',
            line: 1,
            commit: 'sha',
            severity: 'critical',
            message: 'm',
          },
          {
            date: '2026-07-27',
            check: 'c',
            chunk: 'x',
            file: 'b.ts',
            line: 2,
            commit: 'sha',
            severity: 'normal',
            message: 'm',
          },
        ],
      },
      {
        date: '2026-07-26',
        passCount: 1,
        costUsd: 9,
        findings: [
          {
            date: '2026-07-26',
            check: 'c',
            chunk: 'x',
            file: 'c.ts',
            line: 3,
            commit: 'sha',
            severity: 'high',
            message: 'm',
          },
        ],
      },
    ];
    const result = sumHubNumbers({
      totalCount: 1,
      dataByUrl: { a1: projectData({ nightGroups: groups }) },
      sevenDayFloorPct: 70,
    });
    expect(result.lastNight).toEqual({
      passCount: 2,
      costUsd: 1.5,
      findingsBySeverity: { critical: 1, normal: 1 },
    });
  });
});
