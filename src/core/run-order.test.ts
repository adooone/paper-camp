import { describe, expect, it } from 'vitest';
import { type RunOrderEntry, normalizeRunOrder } from './run-order';

const entry = (overrides: Partial<RunOrderEntry>): RunOrderEntry => ({
  id: 'IDEA-1',
  status: 'planned',
  created: '2026-07-01',
  ...overrides,
});

describe('normalizeRunOrder', () => {
  it('renumbers active entries to contiguous 1..N preserving relative order', () => {
    const entries = [
      entry({ id: 'A', order: 4 }),
      entry({ id: 'B', order: 7 }),
      entry({ id: 'C', order: 9 }),
    ];
    expect(normalizeRunOrder(entries)).toEqual([
      { id: 'A', order: 1 },
      { id: 'B', order: 2 },
      { id: 'C', order: 3 },
    ]);
  });

  it('appends unordered active entries after ordered ones, by created date', () => {
    const entries = [
      entry({ id: 'A', order: 1 }),
      entry({ id: 'B', created: '2026-07-03' }),
      entry({ id: 'C', created: '2026-07-02' }),
    ];
    expect(normalizeRunOrder(entries)).toEqual([
      { id: 'C', order: 2 },
      { id: 'B', order: 3 },
    ]);
  });

  it('clears order from entries outside planned/in-progress/review', () => {
    const entries = [
      entry({ id: 'A', order: 1 }),
      entry({ id: 'B', order: 2, status: 'done' }),
      entry({ id: 'C', order: 3, status: 'idea' }),
    ];
    expect(normalizeRunOrder(entries)).toEqual([
      { id: 'B', order: undefined },
      { id: 'C', order: undefined },
    ]);
  });

  it('moves an entry to the requested slot and reflows the rest', () => {
    const entries = [
      entry({ id: 'A', order: 1 }),
      entry({ id: 'B', order: 2 }),
      entry({ id: 'C', order: 3 }),
    ];
    expect(normalizeRunOrder(entries, { id: 'C', order: 1 })).toEqual([
      { id: 'C', order: 1 },
      { id: 'A', order: 2 },
      { id: 'B', order: 3 },
    ]);
  });

  it('clamps a requested slot beyond N to the end', () => {
    const entries = [entry({ id: 'A', order: 1 }), entry({ id: 'B', order: 2 })];
    expect(normalizeRunOrder(entries, { id: 'A', order: 99 })).toEqual([
      { id: 'B', order: 1 },
      { id: 'A', order: 2 },
    ]);
  });

  it('returns no changes when the invariant already holds', () => {
    const entries = [
      entry({ id: 'A', order: 1 }),
      entry({ id: 'B', order: 2, status: 'review' }),
      entry({ id: 'C', status: 'done' }),
    ];
    expect(normalizeRunOrder(entries)).toEqual([]);
  });
});
