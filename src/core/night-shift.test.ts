import { describe, expect, it, vi } from 'vitest';
import type { MachineNightGateResponse, NightHealthMap } from '../types/index';
import {
  type NightShiftDeps,
  createNightShiftState,
  isNightPassRunning,
  nightShiftTick,
} from './night-shift';

const openGate = (): MachineNightGateResponse => ({
  slug: 'app',
  projectMissing: false,
  pausedUntil: null,
  gate: { open: true, reasons: [], fiveHourUtilizationPct: 10, sevenDayUtilizationPct: 20 },
});

const closedGate = (): MachineNightGateResponse => ({
  slug: 'app',
  projectMissing: false,
  pausedUntil: null,
  gate: {
    open: false,
    reasons: ['seven-day-floor'],
    fiveHourUtilizationPct: 10,
    sevenDayUtilizationPct: 80,
  },
});

const map = (scores: Record<string, number>): NightHealthMap => ({
  generatedAt: '2026-09-11T00:00:00.000Z',
  chunks: Object.entries(scores).map(([path, score]) => ({
    path,
    score,
    signals: {
      churnCommits: 0,
      lines: 0,
      coveragePct: null,
      openFindings: 0,
      daysSinceReviewed: null,
    },
    lastReviewedAt: null,
    lastReviewedCommit: null,
  })),
});

function deps(overrides: Partial<NightShiftDeps> = {}): NightShiftDeps {
  return {
    evaluateGate: vi.fn(async () => openGate()),
    findProject: vi.fn(async () => ({ slug: 'app', path: '/repo/app' })),
    readSettings: vi.fn(async () => ({ threshold: 40, maxChunks: 3 })),
    computeMap: vi.fn(async () => map({ 'src/a': 80, 'src/b': 60, 'src/c': 30 })),
    runPass: vi.fn(async () => true),
    isMachineBusy: () => false,
    log: () => {},
    ...overrides,
  };
}

describe('nightShiftTick', () => {
  it('reviews the chunks above the threshold in score order while the gate stays open', async () => {
    const d = deps();
    await nightShiftTick(createNightShiftState(), d);
    expect(vi.mocked(d.runPass).mock.calls.map(([, chunk]) => chunk)).toEqual(['src/a', 'src/b']);
  });

  it('does nothing while the gate is closed', async () => {
    const d = deps({ evaluateGate: vi.fn(async () => closedGate()) });
    await nightShiftTick(createNightShiftState(), d);
    expect(d.computeMap).not.toHaveBeenCalled();
    expect(d.runPass).not.toHaveBeenCalled();
  });

  it('stops between passes the moment the gate closes', async () => {
    const gate = vi
      .fn(async () => openGate())
      .mockResolvedValueOnce(openGate())
      .mockResolvedValueOnce(closedGate());
    const d = deps({ evaluateGate: gate });
    await nightShiftTick(createNightShiftState(), d);
    expect(d.runPass).toHaveBeenCalledTimes(1);
  });

  it('never reviews the same chunk twice in one night, and forgets on the next', async () => {
    const d = deps({ readSettings: vi.fn(async () => ({ threshold: 40, maxChunks: 1 })) });
    const state = createNightShiftState();
    const clock = { now: Date.parse('2026-09-11T01:00:00.000Z') };
    d.now = () => clock.now;

    await nightShiftTick(state, d);
    await nightShiftTick(state, d);
    expect(vi.mocked(d.runPass).mock.calls.map(([, chunk]) => chunk)).toEqual(['src/a', 'src/b']);

    clock.now = Date.parse('2026-09-12T01:00:00.000Z');
    await nightShiftTick(state, d);
    expect(vi.mocked(d.runPass).mock.calls.map(([, chunk]) => chunk)).toEqual([
      'src/a',
      'src/b',
      'src/a',
    ]);
  });

  it('holds the pass lock for the repo while running and releases it after', async () => {
    let lockedDuringPass = false;
    const d = deps({
      runPass: vi.fn(async (project) => {
        lockedDuringPass = isNightPassRunning(project.path);
        return true;
      }),
    });
    await nightShiftTick(createNightShiftState(), d);
    expect(lockedDuringPass).toBe(true);
    expect(isNightPassRunning('/repo/app')).toBe(false);
  });

  it('skips a tick while the machine has a task running', async () => {
    const d = deps({ isMachineBusy: () => true });
    await nightShiftTick(createNightShiftState(), d);
    expect(d.runPass).not.toHaveBeenCalled();
  });
});
