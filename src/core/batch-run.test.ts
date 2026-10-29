import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RateLimitSnapshot } from '../types/index';
import {
  type BatchRunState,
  clearBatchRunState,
  evaluateBatchBudget,
  evaluateBatchCapacityGate,
  markBatchRunInterrupted,
  readBatchRunState,
  writeBatchRunState,
} from './batch-run';

describe('evaluateBatchCapacityGate', () => {
  const snapshot = (fiveHour: number, sevenDay: number): RateLimitSnapshot => ({
    status: 'allowed',
    unifiedWindows: {
      five_hour: { utilization: fiveHour, resetsAt: 1700 },
      seven_day: { utilization: sevenDay },
    },
  });

  it('is open with no snapshot yet', () => {
    expect(evaluateBatchCapacityGate({ snapshot: null, ceiling: 50, floor: 70 })).toEqual({
      open: true,
    });
  });

  it('is open under both windows', () => {
    const result = evaluateBatchCapacityGate({
      snapshot: snapshot(0.1, 0.1),
      ceiling: 50,
      floor: 70,
    });
    expect(result).toEqual({ open: true });
  });

  it('blocks on the five-hour ceiling, carrying the reset time', () => {
    const result = evaluateBatchCapacityGate({
      snapshot: snapshot(0.6, 0.1),
      ceiling: 50,
      floor: 70,
    });
    expect(result).toEqual({ open: false, reason: 'ceiling', resetsAt: 1700 });
  });

  it('blocks on the seven-day floor even when the ceiling is fine', () => {
    const result = evaluateBatchCapacityGate({
      snapshot: snapshot(0.1, 0.8),
      ceiling: 50,
      floor: 70,
    });
    expect(result).toEqual({ open: false, reason: 'floor' });
  });

  it('prefers the floor reason when both windows are over', () => {
    const result = evaluateBatchCapacityGate({
      snapshot: snapshot(0.9, 0.9),
      ceiling: 50,
      floor: 70,
    });
    expect(result).toEqual({ open: false, reason: 'floor' });
  });
});

describe('evaluateBatchBudget', () => {
  it('does not stop with every limit unset', () => {
    expect(evaluateBatchBudget({ now: Date.now(), ideasRun: 0, costUsd: 0 })).toEqual({
      stop: false,
    });
  });

  it('stops once the clock limit has passed', () => {
    const result = evaluateBatchBudget({ now: 2000, stopAtMs: 1000, ideasRun: 0, costUsd: 0 });
    expect(result).toEqual({ stop: true, reason: 'clock' });
  });

  it('stops once the idea count limit is reached', () => {
    const result = evaluateBatchBudget({ now: 0, ideasRun: 3, maxIdeas: 3, costUsd: 0 });
    expect(result).toEqual({ stop: true, reason: 'max-ideas' });
  });

  it('stops once the cost limit is reached', () => {
    const result = evaluateBatchBudget({ now: 0, ideasRun: 0, costUsd: 5, maxCostUsd: 5 });
    expect(result).toEqual({ stop: true, reason: 'max-cost' });
  });

  it('checks the clock before the other limits', () => {
    const result = evaluateBatchBudget({
      now: 2000,
      stopAtMs: 1000,
      ideasRun: 0,
      maxIdeas: 100,
      costUsd: 0,
      maxCostUsd: 100,
    });
    expect(result).toEqual({ stop: true, reason: 'clock' });
  });
});

describe('batch run state persistence', () => {
  const dirs: string[] = [];

  beforeEach(async () => {
    dirs.push(await mkdtemp(join(tmpdir(), 'paper-camp-batch-run-test-')));
  });

  afterEach(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  const root = () => dirs[dirs.length - 1];

  function sampleState(status: BatchRunState['status']): BatchRunState {
    return {
      taskId: 'task-1',
      startedAt: '2026-10-29T00:00:00.000Z',
      updatedAt: '2026-10-29T00:00:00.000Z',
      rules: { pickupUnblocked: true, onCeiling: 'wait' },
      toleratedRed: [],
      initialIds: ['IDEA-1', 'IDEA-2'],
      items: [
        { id: 'IDEA-1', title: 'First', outcome: 'queued' },
        { id: 'IDEA-2', title: 'Second', outcome: 'queued' },
      ],
      ideasRun: 0,
      costUsd: 0,
      status,
    };
  }

  it('returns null when nothing has been written yet', async () => {
    expect(await readBatchRunState(root())).toBeNull();
  });

  it('round-trips a written state', async () => {
    const state = sampleState('running');
    await writeBatchRunState(root(), state);
    expect(await readBatchRunState(root())).toEqual(state);
  });

  it('clears the persisted state', async () => {
    await writeBatchRunState(root(), sampleState('done'));
    await clearBatchRunState(root());
    expect(await readBatchRunState(root())).toBeNull();
  });

  it('marks a running batch interrupted and leaves other states alone', async () => {
    await writeBatchRunState(root(), sampleState('running'));
    expect(await markBatchRunInterrupted(root())).toBe(true);
    expect((await readBatchRunState(root()))?.status).toBe('interrupted');

    await writeBatchRunState(root(), sampleState('paused'));
    expect(await markBatchRunInterrupted(root())).toBe(false);
    expect((await readBatchRunState(root()))?.status).toBe('paused');
  });

  it('is a no-op with nothing persisted', async () => {
    expect(await markBatchRunInterrupted(root())).toBe(false);
  });
});
