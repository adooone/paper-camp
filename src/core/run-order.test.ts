import { describe, expect, it } from 'vitest';
import { type RunOrderEntry, normalizeRunOrder, sameRunOrder } from './run-order';

const entry = (overrides: Partial<RunOrderEntry>): RunOrderEntry => ({
  id: 'IDEA-1',
  title: 'Idea one',
  status: 'planned',
  created: '2026-07-01',
  ...overrides,
});

describe('normalizeRunOrder', () => {
  it('keeps list order for entries still in an ordered status', () => {
    const list = [
      { id: 'A', title: 'A old title' },
      { id: 'B', title: 'B' },
      { id: 'C', title: 'C' },
    ];
    const entries = [
      entry({ id: 'A', title: 'A' }),
      entry({ id: 'B', title: 'B' }),
      entry({ id: 'C', title: 'C' }),
    ];
    expect(normalizeRunOrder(list, entries)).toEqual([
      { id: 'A', title: 'A' },
      { id: 'B', title: 'B' },
      { id: 'C', title: 'C' },
    ]);
  });

  it('drops list ids no longer in an ordered status', () => {
    const list = [
      { id: 'A', title: 'A' },
      { id: 'B', title: 'B' },
    ];
    const entries = [
      entry({ id: 'A', title: 'A' }),
      entry({ id: 'B', title: 'B', status: 'done' }),
    ];
    expect(normalizeRunOrder(list, entries)).toEqual([{ id: 'A', title: 'A' }]);
  });

  it('drops list ids gone from the corpus', () => {
    const list = [
      { id: 'A', title: 'A' },
      { id: 'GONE', title: 'Deleted idea' },
    ];
    const entries = [entry({ id: 'A', title: 'A' })];
    expect(normalizeRunOrder(list, entries)).toEqual([{ id: 'A', title: 'A' }]);
  });

  it('appends ordered entities missing from the list, oldest created first', () => {
    const list = [{ id: 'A', title: 'A' }];
    const entries = [
      entry({ id: 'A', title: 'A' }),
      entry({ id: 'B', title: 'B', created: '2026-07-03' }),
      entry({ id: 'C', title: 'C', created: '2026-07-02' }),
    ];
    expect(normalizeRunOrder(list, entries)).toEqual([
      { id: 'A', title: 'A' },
      { id: 'C', title: 'C' },
      { id: 'B', title: 'B' },
    ]);
  });

  it('refreshes titles from the live corpus', () => {
    const list = [{ id: 'A', title: 'Stale title' }];
    const entries = [entry({ id: 'A', title: 'Fresh title' })];
    expect(normalizeRunOrder(list, entries)).toEqual([{ id: 'A', title: 'Fresh title' }]);
  });

  it('moves an entry to the requested slot and reflows the rest', () => {
    const list = [
      { id: 'A', title: 'A' },
      { id: 'B', title: 'B' },
      { id: 'C', title: 'C' },
    ];
    const entries = [
      entry({ id: 'A', title: 'A' }),
      entry({ id: 'B', title: 'B' }),
      entry({ id: 'C', title: 'C' }),
    ];
    expect(normalizeRunOrder(list, entries, { id: 'C', order: 1 })).toEqual([
      { id: 'C', title: 'C' },
      { id: 'A', title: 'A' },
      { id: 'B', title: 'B' },
    ]);
  });

  it('clamps a requested slot beyond N to the end', () => {
    const list = [
      { id: 'A', title: 'A' },
      { id: 'B', title: 'B' },
    ];
    const entries = [entry({ id: 'A', title: 'A' }), entry({ id: 'B', title: 'B' })];
    expect(normalizeRunOrder(list, entries, { id: 'A', order: 99 })).toEqual([
      { id: 'B', title: 'B' },
      { id: 'A', title: 'A' },
    ]);
  });

  it('returns an empty list when nothing is ordered', () => {
    const entries = [entry({ id: 'A', status: 'done' })];
    expect(normalizeRunOrder([], entries)).toEqual([]);
  });
});

describe('sameRunOrder', () => {
  it('is true for identical id sequences regardless of title', () => {
    const a = [
      { id: 'A', title: 'A' },
      { id: 'B', title: 'B' },
    ];
    const b = [
      { id: 'A', title: 'A refreshed' },
      { id: 'B', title: 'B' },
    ];
    expect(sameRunOrder(a, b)).toBe(true);
  });

  it('is false when order or membership differs', () => {
    expect(sameRunOrder([{ id: 'A', title: 'A' }], [{ id: 'B', title: 'B' }])).toBe(false);
    expect(
      sameRunOrder(
        [
          { id: 'A', title: 'A' },
          { id: 'B', title: 'B' },
        ],
        [
          { id: 'B', title: 'B' },
          { id: 'A', title: 'A' },
        ],
      ),
    ).toBe(false);
  });
});
