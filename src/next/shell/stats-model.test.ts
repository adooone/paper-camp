import { describe, expect, it } from 'vitest';
import type { ProjectStats } from '@/types/index';
import { healthMeaning, statTiles } from './stats-model';

const stats = (extra: Partial<ProjectStats> = {}): ProjectStats => ({
  generatedAt: '2026-11-22T10:00:00.000Z',
  comments: { commentLines: 12, sourceLines: 400, ratio: 0.03 } as ProjectStats['comments'],
  testLines: 900,
  testCoveragePct: 81.4,
  entitiesByStatus: { done: 5, idea: 2 },
  openQuestions: 1,
  decisions: 3,
  tasksPerWeek: [
    { week: '2026-W46', count: 4, failedCount: 1 },
    { week: '2026-W47', count: 2, failedCount: 0 },
  ],
  usagePerWeek: [],
  medianPhaseDurationMs: null,
  mostExpensiveIdeas: [],
  capacity: null,
  nightHealth: { generatedAt: '2026-11-22T10:00:00.000Z', chunks: [] },
  ...extra,
});

const tile = (data: ProjectStats, key: string) => {
  const found = statTiles(data).find((candidate) => candidate.key === key);
  if (!found) throw new Error(`no tile ${key}`);
  return found;
};

describe('statTiles', () => {
  it('turns the headline numbers into figures', () => {
    expect(tile(stats(), 'coverage').figure).toBe('81%');
    expect(tile(stats(), 'comments').figure).toBe('3%');
    expect(tile(stats({ testCoveragePct: null }), 'coverage').figure).toBe('—');
    expect(tile(stats({ testCoveragePct: null }), 'coverage').empty).toContain('pnpm test');
  });

  it('orders the entity statuses and skips the empty ones', () => {
    expect(tile(stats(), 'status').lines).toEqual([
      { label: 'Idea', value: '2' },
      { label: 'Done', value: '5' },
    ]);
    expect(tile(stats({ entitiesByStatus: {} }), 'status').empty).toBe('No entities yet.');
  });

  it('totals the weekly runs and flags failures', () => {
    const tasks = tile(stats(), 'tasks');
    expect(tasks.figure).toBe('6');
    expect(tasks.lines[0]).toEqual({ label: '2026-W46', value: '4', detail: '1 failed' });
    expect(tile(stats({ tasksPerWeek: [] }), 'tasks').empty).toBe('No tasks run yet.');
  });

  it('says so when nothing reported capacity', () => {
    expect(tile(stats(), 'capacity').empty).toBe('No agent run has reported capacity yet.');
    expect(tile(stats(), 'median').figure).toBe('—');
  });

  it('grades the code health score', () => {
    expect(healthMeaning(10)).toBe('done');
    expect(healthMeaning(34)).toBe('parked');
    expect(healthMeaning(80)).toBe('failed');
  });
});
