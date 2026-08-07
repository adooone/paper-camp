import { describe, expect, it } from 'vitest';
import type { RunUsage, TaskLogEntry } from '../types/index';
import {
  formatDuration,
  formatRunLine,
  formatTokens,
  mergeRun,
  parseRunLine,
  rollupUsage,
  shortModel,
} from './phase-run';

describe('formatDuration', () => {
  it('renders minutes and seconds, dropping empty trailing units', () => {
    expect(formatDuration(400_000)).toBe('6m40s');
    expect(formatDuration(360_000)).toBe('6m');
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(3_900_000)).toBe('1h5m');
  });
});

describe('formatTokens', () => {
  it('compacts to k/M with a trimmed single decimal', () => {
    expect(formatTokens(1_200_000)).toBe('1.2M');
    expect(formatTokens(1_000_000)).toBe('1M');
    expect(formatTokens(38_000)).toBe('38k');
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(900)).toBe('900');
  });
});

describe('shortModel', () => {
  it('strips the claude prefix and a trailing date', () => {
    expect(shortModel('claude-fable-5')).toBe('fable-5');
    expect(shortModel('claude-opus-4-8-20260101')).toBe('opus-4-8');
    expect(shortModel('us.anthropic.claude-sonnet-5')).toBe('sonnet-5');
  });
});

describe('run line round-trip', () => {
  it('formats and parses back to equivalent structured values', () => {
    const run = {
      durationMs: 400_000,
      inputTokens: 1_200_000,
      outputTokens: 38_000,
      model: 'fable-5',
      attempts: 1,
    };
    expect(formatRunLine(run)).toBe('6m40s · 1.2M in · 38k out · fable-5');
    expect(parseRunLine(formatRunLine(run))).toEqual(run);
  });

  it('carries an attempt count when the phase ran more than once', () => {
    const run = {
      durationMs: 800_000,
      inputTokens: 2_400_000,
      outputTokens: 76_000,
      model: 'fable-5',
      attempts: 3,
    };
    expect(formatRunLine(run)).toBe('13m20s · 2.4M in · 76k out · fable-5 · ×3');
    expect(parseRunLine(formatRunLine(run))?.attempts).toBe(3);
  });

  it('omits the model segment when there is none', () => {
    const run = { durationMs: 1000, inputTokens: 0, outputTokens: 0, attempts: 1 };
    expect(formatRunLine(run)).toBe('1s · 0 in · 0 out');
    expect(parseRunLine(formatRunLine(run))?.model).toBeUndefined();
  });
});

describe('mergeRun', () => {
  const usage: RunUsage = {
    durationMs: 400_000,
    numTurns: 12,
    model: 'claude-fable-5',
    inputTokens: 1_200_000,
    outputTokens: 38_000,
    cacheCreationTokens: 5000,
    cacheReadTokens: 900_000,
    costUsd: 1.23,
  };

  it('starts a fresh record at one attempt with the shortened model', () => {
    expect(mergeRun(undefined, usage)).toEqual({
      durationMs: 400_000,
      inputTokens: 1_200_000,
      outputTokens: 38_000,
      model: 'fable-5',
      attempts: 1,
    });
  });

  it('sums onto a prior record and bumps the attempt count', () => {
    const prev = mergeRun(undefined, usage);
    expect(mergeRun(prev, usage)).toEqual({
      durationMs: 800_000,
      inputTokens: 2_400_000,
      outputTokens: 76_000,
      model: 'fable-5',
      attempts: 2,
    });
  });
});

describe('rollupUsage', () => {
  const usage = (durationMs: number, input: number, output: number): RunUsage => ({
    durationMs,
    numTurns: 1,
    inputTokens: input,
    outputTokens: output,
    cacheCreationTokens: 10,
    cacheReadTokens: 20,
    costUsd: 0,
  });
  const base = {
    taskKind: 'phase' as const,
    planTitle: 'X',
    agentId: 'claude-code' as const,
    startedAt: '2026-08-01T00:00:00Z',
    endedAt: '2026-08-01T00:10:00Z',
    outcome: 'done' as const,
  };

  it('sums per-phase run-all entries and single overhead runs, counting each run', () => {
    const entries: TaskLogEntry[] = [
      {
        ...base,
        id: 'a',
        planId: 'IDEA-1',
        taskKind: 'run-all',
        phaseRuns: [
          { kind: 'phase', index: 0, usage: usage(1000, 100, 10) },
          { kind: 'phase', index: 1, usage: usage(2000, 200, 20) },
        ],
      },
      { ...base, id: 'b', planId: 'IDEA-1', taskKind: 'draft', usage: usage(500, 50, 5) },
      { ...base, id: 'c', planId: 'IDEA-2', taskKind: 'draft', usage: usage(999, 99, 9) },
      { ...base, id: 'd', planId: 'IDEA-1', taskKind: 'feedback' },
    ];
    expect(rollupUsage(entries, 'IDEA-1')).toEqual({
      runs: 3,
      durationMs: 3500,
      inputTokens: 350,
      outputTokens: 35,
      cacheCreationTokens: 30,
      cacheReadTokens: 60,
    });
  });

  it('returns an empty rollup when no entries match the plan', () => {
    expect(rollupUsage([], 'IDEA-1').runs).toBe(0);
  });
});
