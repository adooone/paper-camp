import type { IdeaEntry, PlanEntry } from '@/types/index';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPlansAt = vi.fn();
const fetchIdeasAt = vi.fn();

vi.mock('@/app/services/content/plans-api', () => ({ fetchPlansAt }));
vi.mock('@/app/services/content/ideas-api', () => ({ fetchIdeasAt }));

const { loadScopeProjectData, cachedScopeProjectData } = await import('./use-scope-worklist');

const plan = (title: string): PlanEntry => ({ title }) as unknown as PlanEntry;
const idea = (title: string): IdeaEntry => ({ title }) as unknown as IdeaEntry;

describe('loadScopeProjectData', () => {
  beforeEach(() => {
    fetchPlansAt.mockReset();
    fetchIdeasAt.mockReset();
  });

  it('resolves with the fetched plans and ideas for that project', async () => {
    fetchPlansAt.mockResolvedValue({ entries: [plan('a')] });
    fetchIdeasAt.mockResolvedValue({ entries: [idea('b')] });
    const result = await loadScopeProjectData('http://project-a');
    expect(result).toEqual({ plans: [plan('a')], ideas: [idea('b')] });
    expect(fetchPlansAt).toHaveBeenCalledWith('http://project-a');
    expect(fetchIdeasAt).toHaveBeenCalledWith('http://project-a');
  });

  it('falls back to empty lists when a fetch fails', async () => {
    fetchPlansAt.mockResolvedValue(null);
    fetchIdeasAt.mockResolvedValue(null);
    const result = await loadScopeProjectData('http://project-b');
    expect(result).toEqual({ plans: [], ideas: [] });
  });

  it('lets a faster project resolve before a slower one, not bundled behind it', async () => {
    let resolveSlow: (() => void) | undefined;
    fetchPlansAt.mockImplementation((url: string) => {
      if (url === 'http://slow') {
        return new Promise((resolve) => {
          resolveSlow = () => resolve({ entries: [] });
        });
      }
      return Promise.resolve({ entries: [] });
    });
    fetchIdeasAt.mockResolvedValue({ entries: [] });

    const order: string[] = [];
    const slow = loadScopeProjectData('http://slow').then(() => order.push('slow'));
    const fast = loadScopeProjectData('http://fast').then(() => order.push('fast'));

    await fast;
    expect(order).toEqual(['fast']);
    resolveSlow?.();
    await slow;
    expect(order).toEqual(['fast', 'slow']);
  });
});

describe('cachedScopeProjectData', () => {
  beforeEach(() => {
    fetchPlansAt.mockReset();
    fetchIdeasAt.mockReset();
  });

  it('is empty for a project never fetched', () => {
    expect(cachedScopeProjectData(['http://never-fetched'])).toEqual({});
  });

  it('holds the last result a project resolved with, for remounting into', async () => {
    fetchPlansAt.mockResolvedValue({ entries: [plan('cached')] });
    fetchIdeasAt.mockResolvedValue({ entries: [] });
    await loadScopeProjectData('http://project-d');
    expect(cachedScopeProjectData(['http://project-d'])).toEqual({
      'http://project-d': { plans: [plan('cached')], ideas: [] },
    });
  });
});
