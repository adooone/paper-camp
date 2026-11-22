import { describe, expect, it } from 'vitest';
import type { ResolvedRoadmapHorizon, ResolvedRoadmapItem } from '@/types/index';
import {
  goalLine,
  horizonSummary,
  itemDetail,
  itemStateStamp,
  matchesSearch,
  openUnfiled,
  rollupFigure,
} from './roadmap-model';

const item = (extra: Partial<ResolvedRoadmapItem> = {}): ResolvedRoadmapItem => ({
  name: 'Offline mode',
  description: 'Work without the daemon',
  candidates: [],
  linked: [],
  ideas: [],
  rollup: { total: 4, done: 1, open: 3 },
  state: 'in-progress',
  readyToShip: false,
  ...extra,
});

describe('item stamps', () => {
  it('maps each state and flags an item ready to ship', () => {
    expect(itemStateStamp(item({ state: 'not-started' }))).toEqual({
      label: 'not started',
      meaning: 'idle',
    });
    expect(itemStateStamp(item())).toEqual({ label: 'in progress', meaning: 'parked' });
    expect(itemStateStamp(item({ readyToShip: true }))).toEqual({
      label: 'ready to ship',
      meaning: 'running',
    });
    expect(itemStateStamp(item({ state: 'shipped' }))).toEqual({
      label: 'shipped',
      meaning: 'done',
    });
  });
});

describe('item copy', () => {
  it('summarises the rollup and the thought count', () => {
    expect(itemDetail(item())).toBe('1 of 4 shipped · 3 open');
    expect(itemDetail(item({ rollup: { total: 0, done: 0, open: 0 }, candidates: ['a'] }))).toBe(
      'No ideas yet · 1 thought',
    );
    expect(itemDetail(item({ candidates: ['a', 'b'] }))).toBe(
      '1 of 4 shipped · 3 open · 2 thoughts',
    );
  });

  it('shows a dash for an empty rollup', () => {
    expect(rollupFigure({ total: 0, done: 0, open: 0 })).toBe('—');
    expect(rollupFigure({ total: 5, done: 2, open: 3 })).toBe('2/5');
  });

  it('counts the items not started in a horizon', () => {
    const horizon: ResolvedRoadmapHorizon = {
      title: 'Now',
      intro: '',
      items: [item({ state: 'not-started' }), item()],
      rollup: { total: 8, done: 2, open: 6 },
    };
    expect(horizonSummary(horizon)).toBe('2 of 8 ideas shipped · 1 item not started');
  });
});

describe('unfiled and search', () => {
  it('drops closed ideas from the unfiled list', () => {
    const ref = (id: string, status: 'idea' | 'done' | 'dropped') => ({ id, title: id, status });
    expect(openUnfiled([ref('a', 'idea'), ref('b', 'done'), ref('c', 'dropped')])).toEqual([
      ref('a', 'idea'),
    ]);
  });

  it('matches the name, description or a thought, case-insensitively', () => {
    expect(matchesSearch(item(), '')).toBe(true);
    expect(matchesSearch(item(), 'OFFLINE')).toBe(true);
    expect(matchesSearch(item(), 'daemon')).toBe(true);
    expect(matchesSearch(item({ candidates: ['Sync later'] }), 'sync')).toBe(true);
    expect(matchesSearch(item(), 'zzz')).toBe(false);
  });

  it('cuts the goal at its first sentence', () => {
    expect(goalLine('Ship it. Then rest.')).toBe('Ship it.');
    expect(goalLine('No full stop here')).toBe('No full stop here');
  });
});
