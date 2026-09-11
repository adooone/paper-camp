import { describe, expect, it } from 'vitest';
import { NIGHT_BUILTIN_CHECKS, resolveNightChecks } from './night-checks';

describe('resolveNightChecks', () => {
  it('runs every built-in check by default', () => {
    const checks = resolveNightChecks(undefined);
    expect(checks.map((c) => c.id)).toEqual(NIGHT_BUILTIN_CHECKS.map((c) => c.id));
  });

  it('skips a built-in check explicitly turned off', () => {
    const checks = resolveNightChecks({ checks: { security: false } });
    expect(checks.some((c) => c.id === 'security')).toBe(false);
    expect(checks).toHaveLength(NIGHT_BUILTIN_CHECKS.length - 1);
  });

  it('keeps a built-in check explicitly turned on', () => {
    const checks = resolveNightChecks({ checks: { bugs: true } });
    expect(checks.some((c) => c.id === 'bugs')).toBe(true);
  });

  it('appends custom checks after the built-ins, run the same way', () => {
    const checks = resolveNightChecks({
      customChecks: [{ name: 'license-headers', prompt: 'Flag files missing a license header.' }],
    });
    expect(checks.at(-1)).toEqual({
      id: 'license-headers',
      name: 'license-headers',
      instructions: 'Flag files missing a license header.',
    });
  });

  it('turns off every built-in but keeps custom checks', () => {
    const allOff = Object.fromEntries(NIGHT_BUILTIN_CHECKS.map((c) => [c.id, false]));
    const checks = resolveNightChecks({
      checks: allOff,
      customChecks: [{ name: 'custom', prompt: 'x' }],
    });
    expect(checks).toEqual([{ id: 'custom', name: 'custom', instructions: 'x' }]);
  });
});
