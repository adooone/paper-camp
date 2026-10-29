import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PlansSlice, createPlansSlice } from './plans-slice';

const makeStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const makeSlice = (): { get: () => PlansSlice } => {
  let state = {} as PlansSlice;
  const set = (patch: Partial<PlansSlice> | ((s: PlansSlice) => Partial<PlansSlice>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  state = createPlansSlice(set as never);
  return { get: () => state };
};

describe('plan list grouping', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to grouping by subject', () => {
    expect(makeSlice().get().planFilters.group).toBe('subject');
  });

  // Opening a plan and coming back remounts the list; the choice must outlive that.
  it('keeps the chosen grouping for the next mount', () => {
    makeSlice().get().setPlanGroup('plain');
    expect(makeSlice().get().planFilters.group).toBe('plain');
  });

  it('fills in grouping for filters saved before it was a filter', () => {
    localStorage.setItem(
      'plan-filters',
      JSON.stringify({ value: { search: 'pair', sortKey: 'title' }, storedAt: Date.now() }),
    );
    const { planFilters } = makeSlice().get();
    expect(planFilters.group).toBe('subject');
    expect(planFilters.search).toBe('pair');
    expect(planFilters.statuses.length).toBeGreaterThan(0);
  });
});
