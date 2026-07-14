import { describe, expect, it } from 'vitest';
import type { PhaseItem } from '../../types/index';
import { computePlanContentHash } from './content-hash';

const PHASES: PhaseItem[] = [
  { done: true, text: 'First phase' },
  { done: false, text: 'Second phase', description: 'Some detail.' },
];

describe('computePlanContentHash', () => {
  it('is stable for the same content', () => {
    const a = computePlanContentHash({ body: 'Plan body.', phases: PHASES });
    const b = computePlanContentHash({ body: 'Plan body.', phases: PHASES });
    expect(a).toBe(b);
  });

  it('changes when the body prose changes', () => {
    const before = computePlanContentHash({ body: 'Plan body.', phases: PHASES });
    const after = computePlanContentHash({ body: 'Plan body, edited.', phases: PHASES });
    expect(after).not.toBe(before);
  });

  it('changes when a phase is edited', () => {
    const before = computePlanContentHash({ body: 'Plan body.', phases: PHASES });
    const edited = [...PHASES];
    edited[1] = { ...edited[1], text: 'Second phase, reworded' };
    const after = computePlanContentHash({ body: 'Plan body.', phases: edited });
    expect(after).not.toBe(before);
  });

  it('changes when a phase is checked off', () => {
    const before = computePlanContentHash({ body: 'Plan body.', phases: PHASES });
    const edited = [...PHASES];
    edited[1] = { ...edited[1], done: true };
    const after = computePlanContentHash({ body: 'Plan body.', phases: edited });
    expect(after).not.toBe(before);
  });

  it('changes when a phase is added', () => {
    const before = computePlanContentHash({ body: 'Plan body.', phases: PHASES });
    const after = computePlanContentHash({
      body: 'Plan body.',
      phases: [...PHASES, { done: false, text: 'Third phase' }],
    });
    expect(after).not.toBe(before);
  });

  it('ignores audited/audited-hash fields even when present on the input object', () => {
    const withoutAuditFields = { body: 'Plan body.', phases: PHASES };
    const withAuditFields = {
      ...withoutAuditFields,
      audited: '2026-07-01',
      auditedHash: 'stale-hash-value',
    };
    expect(computePlanContentHash(withAuditFields)).toBe(
      computePlanContentHash(withoutAuditFields),
    );
  });
});
