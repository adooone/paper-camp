import type { GitLogCommit, GitLogResponse } from '@/types/index';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiffSlice } from './diff-slice';
import type { GetState, SetState } from './slice-helpers';

const { fetchGitLogMock } = vi.hoisted(() => ({ fetchGitLogMock: vi.fn() }));

vi.mock('@/app/services/git-api', () => ({
  fetchFileDiffs: vi.fn(),
  fetchGitLog: fetchGitLogMock,
}));

function commit(hash: string): GitLogCommit {
  return {
    hash,
    subject: `commit ${hash}`,
    prefix: '',
    date: '2026-01-01',
    tags: [],
    isUpstreamHead: false,
    pushed: true,
    ideaId: null,
  };
}

function page(commits: GitLogCommit[], hasMore: boolean): GitLogResponse {
  return { commits, upstream: 'origin/main', hasMore };
}

function makeSlice() {
  let state: Record<string, unknown> = {};
  const set: SetState = ((updater: unknown) => {
    const patch =
      typeof updater === 'function' ? (updater as (s: unknown) => unknown)(state) : updater;
    state = { ...state, ...(patch as Record<string, unknown>) };
  }) as SetState;
  const get: GetState = (() => state) as unknown as GetState;
  Object.assign(state, createDiffSlice(set, get));
  return { get, set };
}

describe('loadGitLog', () => {
  afterEach(() => {
    fetchGitLogMock.mockReset();
  });

  it('populates the commits on success', async () => {
    const { get } = makeSlice();
    fetchGitLogMock.mockResolvedValue(page([commit('a')], true));

    await get().loadGitLog();

    expect(get().gitLogCommits).toEqual([commit('a')]);
    expect(get().gitLogLoadFailed).toBe(false);
  });

  // Without this fallback gitLogCommits stayed null forever and the page spun indefinitely.
  it('flags the failure instead of leaving gitLogCommits null forever', async () => {
    const { get } = makeSlice();
    fetchGitLogMock.mockRejectedValue(new Error('network down'));

    await get().loadGitLog();

    expect(get().gitLogCommits).toBeNull();
    expect(get().gitLogLoadFailed).toBe(true);
  });

  it('clears a previous failure on a successful retry', async () => {
    const { get } = makeSlice();
    fetchGitLogMock.mockRejectedValueOnce(new Error('network down'));
    await get().loadGitLog();
    expect(get().gitLogLoadFailed).toBe(true);

    fetchGitLogMock.mockResolvedValueOnce(page([commit('a')], false));
    await get().loadGitLog();

    expect(get().gitLogLoadFailed).toBe(false);
    expect(get().gitLogCommits).toEqual([commit('a')]);
  });
});

describe('loadMoreGitLog', () => {
  afterEach(() => {
    fetchGitLogMock.mockReset();
  });

  it('appends the next page and keeps upstream/hasMore in sync', async () => {
    const { get, set } = makeSlice();
    set({ gitLogCommits: [commit('a')], gitLogHasMore: true, gitLogLoadingMore: false });
    fetchGitLogMock.mockResolvedValue(page([commit('b')], false));

    await get().loadMoreGitLog();

    expect(get().gitLogCommits).toEqual([commit('a'), commit('b')]);
    expect(get().gitLogHasMore).toBe(false);
    expect(get().gitLogLoadingMore).toBe(false);
  });

  it('does nothing when there are no commits loaded yet, no more pages, or a load is already in flight', async () => {
    const { get, set } = makeSlice();

    set({ gitLogCommits: null, gitLogHasMore: true, gitLogLoadingMore: false });
    await get().loadMoreGitLog();
    expect(fetchGitLogMock).not.toHaveBeenCalled();

    set({ gitLogCommits: [commit('a')], gitLogHasMore: false, gitLogLoadingMore: false });
    await get().loadMoreGitLog();
    expect(fetchGitLogMock).not.toHaveBeenCalled();

    set({ gitLogCommits: [commit('a')], gitLogHasMore: true, gitLogLoadingMore: true });
    await get().loadMoreGitLog();
    expect(fetchGitLogMock).not.toHaveBeenCalled();
  });

  // A rejected fetchGitLog used to leave the error unhandled off the 'Show older' click
  // instead of resetting the loading flag and surfacing a failure the page can show.
  it('surfaces the failure and still resets the loading flag on rejection', async () => {
    const { get, set } = makeSlice();
    set({ gitLogCommits: [commit('a')], gitLogHasMore: true, gitLogLoadingMore: false });
    fetchGitLogMock.mockRejectedValue(new Error('network down'));

    await expect(get().loadMoreGitLog()).resolves.toBeUndefined();

    expect(get().gitLogLoadingMore).toBe(false);
    expect(get().gitLogLoadMoreFailed).toBe(true);
    expect(get().gitLogCommits).toEqual([commit('a')]);
  });

  it('clears a previous load-more failure once a retry succeeds', async () => {
    const { get, set } = makeSlice();
    set({ gitLogCommits: [commit('a')], gitLogHasMore: true, gitLogLoadingMore: false });
    fetchGitLogMock.mockRejectedValueOnce(new Error('network down'));
    await get().loadMoreGitLog();
    expect(get().gitLogLoadMoreFailed).toBe(true);

    fetchGitLogMock.mockResolvedValueOnce(page([commit('b')], false));
    await get().loadMoreGitLog();

    expect(get().gitLogLoadMoreFailed).toBe(false);
  });
});
