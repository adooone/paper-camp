import { describe, expect, it } from 'vitest';
import type { TaskLogEntry } from '../types/index';
import {
  PHASE_MAX_FRACTION,
  PHASE_STALL_MS,
  advanceAnchor,
  classifyAnchor,
  isPhaseStalled,
  medianSegmentMs,
  phaseFraction,
} from './phase-progress';

describe('classifyAnchor', () => {
  it('reads Edit/Write/MultiEdit tool calls as implementing', () => {
    expect(classifyAnchor('Edit', { file_path: 'a.ts' })).toBe('implement');
    expect(classifyAnchor('Write', { file_path: 'a.ts' })).toBe('implement');
    expect(classifyAnchor('MultiEdit', { file_path: 'a.ts' })).toBe('implement');
    expect(classifyAnchor('edit', {})).toBe('implement');
  });

  it('reads a check-types Bash call as verifying', () => {
    expect(classifyAnchor('Bash', { command: 'pnpm run check-types' })).toBe('verify');
    expect(classifyAnchor('bash', { command: 'pnpm run check-types' })).toBe('verify');
  });

  it('ignores unrelated Bash commands', () => {
    expect(classifyAnchor('Bash', { command: 'ls -la' })).toBeNull();
    expect(classifyAnchor('Read', { file_path: 'a.ts' })).toBeNull();
  });

  it('reads a checkbox-flipping edit as the checkbox anchor', () => {
    const flip = {
      old_string: '- [ ] Build the phase-progress engine',
      new_string: '- [x] Build the phase-progress engine',
    };
    expect(classifyAnchor('Edit', flip)).toBe('checkbox');
  });

  it("reads OpenCode's camelCase edit keys as the checkbox anchor", () => {
    const flip = {
      oldString: '- [ ] Build the phase-progress engine',
      newString: '- [x] Build the phase-progress engine',
    };
    expect(classifyAnchor('edit', flip)).toBe('checkbox');
  });
});

describe('advanceAnchor', () => {
  it('adopts the first anchor from nothing', () => {
    expect(advanceAnchor(undefined, 'implement')).toBe('implement');
  });

  it('only ever moves forward', () => {
    expect(advanceAnchor('implement', 'verify')).toBe('verify');
    expect(advanceAnchor('verify', 'checkbox')).toBe('checkbox');
  });

  it('never falls back to an earlier anchor', () => {
    expect(advanceAnchor('verify', 'implement')).toBe('verify');
    expect(advanceAnchor('checkbox', 'implement')).toBe('checkbox');
  });
});

describe('isPhaseStalled', () => {
  it('is not stalled without any stream event yet', () => {
    expect(isPhaseStalled(undefined, 1_000_000)).toBe(false);
  });

  it('freezes after the stall window of silence', () => {
    const last = 1_000_000;
    expect(isPhaseStalled(last, last + PHASE_STALL_MS - 1)).toBe(false);
    expect(isPhaseStalled(last, last + PHASE_STALL_MS)).toBe(true);
  });
});

describe('medianSegmentMs', () => {
  const entry = (over: Partial<TaskLogEntry>): TaskLogEntry => ({
    id: 'x',
    taskKind: 'phase',
    planTitle: 'P',
    agentId: 'claude-code',
    startedAt: '2026-08-07T00:00:00.000Z',
    endedAt: '2026-08-07T00:01:00.000Z',
    outcome: 'done',
    ...over,
  });

  it('is empty without any completed phase runs', () => {
    expect(medianSegmentMs([])).toEqual({});
    expect(medianSegmentMs([entry({ outcome: 'error' })])).toEqual({});
    expect(medianSegmentMs([entry({ taskKind: 'run-all' })])).toEqual({});
  });

  it('splits the median phase duration across the interpolated segments', () => {
    const ninetyFiveSeconds = entry({
      startedAt: '2026-08-07T00:00:00.000Z',
      endedAt: '2026-08-07T00:01:35.000Z',
    });
    const segments = medianSegmentMs([ninetyFiveSeconds]);
    expect(segments.implement).toBeCloseTo(60_000, 5);
    expect(segments.verify).toBeCloseTo(30_000, 5);
    expect(segments.checkbox).toBeUndefined();
  });

  it('takes the median across several runs', () => {
    const start = Date.parse('2026-08-07T00:00:00.000Z');
    const runs = [10_000, 95_000, 200_000].map((ms) =>
      entry({
        startedAt: '2026-08-07T00:00:00.000Z',
        endedAt: new Date(start + ms).toISOString(),
      }),
    );
    const segments = medianSegmentMs(runs);
    expect(segments.implement).toBeCloseTo(60_000, 5);
  });
});

describe('phaseFraction', () => {
  const base = { anchorEnteredAt: 1_000_000, lastStreamAt: 1_000_000, now: 1_000_000 };

  it('holds at the segment floor when no history exists', () => {
    expect(phaseFraction({ anchor: undefined, ...base })).toBe(0);
    expect(phaseFraction({ anchor: 'implement', ...base })).toBe(0);
    expect(phaseFraction({ anchor: 'verify', ...base })).toBe(0.6);
    expect(phaseFraction({ anchor: 'checkbox', ...base })).toBe(0.95);
  });

  it('interpolates within a segment from elapsed vs median', () => {
    const medians = { implement: 60_000, verify: 30_000 };
    const at = (ms: number) =>
      phaseFraction({
        anchor: 'implement',
        anchorEnteredAt: 1_000_000,
        lastStreamAt: 1_000_000 + ms,
        now: 1_000_000 + ms,
        medians,
      });
    expect(at(0)).toBeCloseTo(0, 5);
    expect(at(30_000)).toBeCloseTo(0.3, 5);
    expect(at(60_000)).toBeCloseTo(0.6, 5);
  });

  it('caps at the next floor once the median is exceeded', () => {
    expect(
      phaseFraction({
        anchor: 'implement',
        anchorEnteredAt: 1_000_000,
        lastStreamAt: 1_000_000 + 500_000,
        now: 1_000_000 + 500_000,
        medians: { implement: 60_000 },
      }),
    ).toBeCloseTo(0.6, 5);
  });

  it('freezes the fill after the stall window', () => {
    const frozen = phaseFraction({
      anchor: 'implement',
      anchorEnteredAt: 1_000_000,
      lastStreamAt: 1_000_000 + 6_000,
      now: 1_000_000 + 600_000,
      medians: { implement: 60_000 },
    });
    const atStallEdge = 6_000 + PHASE_STALL_MS;
    expect(frozen).toBeCloseTo((atStallEdge / 60_000) * 0.6, 5);
  });

  it('never exceeds the honesty clamp', () => {
    expect(phaseFraction({ anchor: 'checkbox', ...base, medians: { verify: 30_000 } })).toBe(0.95);
  });
});
