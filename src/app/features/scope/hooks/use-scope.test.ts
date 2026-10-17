import { describe, expect, it, vi } from 'vitest';
import { loadScopeCounts } from './use-scope';

const fetchers = (overrides: Partial<Parameters<typeof loadScopeCounts>[3]> = {}) => ({
  openIdeasCount: vi.fn().mockResolvedValue(1),
  unansweredChatCount: vi.fn().mockResolvedValue(2),
  unreadActivityCount: vi.fn().mockResolvedValue(3),
  ...overrides,
});

describe('loadScopeCounts', () => {
  it('maps each url to its count, keyed by url', async () => {
    const f = fetchers({ openIdeasCount: vi.fn().mockResolvedValue(5) });
    const counts = await loadScopeCounts(['a', 'b'], 'ideas', 'a', f);
    expect(counts).toEqual({ a: 5, b: 5 });
  });

  it('calls the ideas fetcher for countKind "ideas"', async () => {
    const f = fetchers();
    await loadScopeCounts(['a'], 'ideas', 'a', f);
    expect(f.openIdeasCount).toHaveBeenCalledWith('a', true);
    expect(f.unansweredChatCount).not.toHaveBeenCalled();
    expect(f.unreadActivityCount).not.toHaveBeenCalled();
  });

  it('calls the chat fetcher for countKind "chat"', async () => {
    const f = fetchers();
    await loadScopeCounts(['a'], 'chat', 'b', f);
    expect(f.unansweredChatCount).toHaveBeenCalledWith('a', false);
  });

  it('calls the activity fetcher for countKind "activity"', async () => {
    const f = fetchers();
    await loadScopeCounts(['a'], 'activity', 'a', f);
    expect(f.unreadActivityCount).toHaveBeenCalledWith('a', true);
  });

  it('passes isCurrent true only for the url matching currentRuntimeUrl', async () => {
    const f = fetchers();
    await loadScopeCounts(['a', 'b'], 'ideas', 'b', f);
    expect(f.openIdeasCount).toHaveBeenCalledWith('a', false);
    expect(f.openIdeasCount).toHaveBeenCalledWith('b', true);
  });

  it('resolves an empty object for an empty url list', async () => {
    const f = fetchers();
    await expect(loadScopeCounts([], 'ideas', 'a', f)).resolves.toEqual({});
  });
});
