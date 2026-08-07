import { describe, expect, it } from 'vitest';
import {
  PHASE_MAX_FRACTION,
  PHASE_STALL_MS,
  advanceAnchor,
  classifyAnchor,
  isPhaseStalled,
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

describe('phaseFraction', () => {
  it('holds at the floor of each segment', () => {
    expect(phaseFraction(undefined)).toBe(0);
    expect(phaseFraction('implement')).toBe(0);
    expect(phaseFraction('verify')).toBe(0.6);
    expect(phaseFraction('checkbox')).toBe(0.95);
  });

  it('never exceeds the honesty clamp', () => {
    expect(phaseFraction('checkbox')).toBeLessThanOrEqual(PHASE_MAX_FRACTION);
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
