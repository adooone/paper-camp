import { fetchFileDiffs, fetchGitLog } from '@/app/services/git-api';
import type { FileDiffEntry, GitLogCommit } from '@/types/index';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type DiffSlice = {
  // Lifted here (not local page state) so the router-level sidebar and the page share one source.
  diffFiles: FileDiffEntry[] | null;
  diffLoadFailed: boolean;
  loadDiffFiles: () => Promise<void>;

  // The section currently scrolled into view; the sidebar highlights the matching row.
  activeDiffPath: string | null;
  setActiveDiffPath: (path: string | null) => void;

  // Explicit collapse/expand overrides from a header click or a scroll-spy jump; a path
  // in neither set falls back to the size-threshold default in file-diff-section.tsx.
  manuallyExpandedDiffPaths: Set<string>;
  manuallyCollapsedDiffPaths: Set<string>;
  setDiffCollapsed: (path: string, collapsed: boolean) => void;
  expandDiffPath: (path: string) => void;

  // The clean-tree history view's pages — replaced wholesale on reload, appended by loadMoreGitLog.
  gitLogCommits: GitLogCommit[] | null;
  gitLogUpstream: string | null;
  gitLogHasMore: boolean;
  gitLogLoadingMore: boolean;
  gitLogLoadFailed: boolean;
  gitLogLoadMoreFailed: boolean;
  loadGitLog: () => Promise<void>;
  loadMoreGitLog: () => Promise<void>;
};

export function createDiffSlice(set: SetState, get: GetState): DiffSlice {
  return {
    diffFiles: null,
    diffLoadFailed: false,
    loadDiffFiles: loadSlice(
      set,
      fetchFileDiffs,
      (files) => ({ diffFiles: files, diffLoadFailed: false }),
      () => ({ diffLoadFailed: true }),
    ),

    activeDiffPath: null,
    setActiveDiffPath: (path) => {
      if (get().activeDiffPath === path) return;
      set({ activeDiffPath: path });
    },

    manuallyExpandedDiffPaths: new Set(),
    manuallyCollapsedDiffPaths: new Set(),
    setDiffCollapsed: (path, collapsed) => {
      set((s) => {
        const expanded = new Set(s.manuallyExpandedDiffPaths);
        const collapsedPaths = new Set(s.manuallyCollapsedDiffPaths);
        if (collapsed) {
          collapsedPaths.add(path);
          expanded.delete(path);
        } else {
          expanded.add(path);
          collapsedPaths.delete(path);
        }
        return { manuallyExpandedDiffPaths: expanded, manuallyCollapsedDiffPaths: collapsedPaths };
      });
    },
    expandDiffPath: (path) => get().setDiffCollapsed(path, false),

    gitLogCommits: null,
    gitLogUpstream: null,
    gitLogHasMore: false,
    gitLogLoadingMore: false,
    gitLogLoadFailed: false,
    gitLogLoadMoreFailed: false,
    loadGitLog: loadSlice(
      set,
      () => fetchGitLog(0),
      (page) => ({
        gitLogCommits: page.commits,
        gitLogUpstream: page.upstream,
        gitLogHasMore: page.hasMore,
        gitLogLoadFailed: false,
      }),
      () => ({ gitLogLoadFailed: true }),
    ),
    loadMoreGitLog: async () => {
      const { gitLogCommits, gitLogHasMore, gitLogLoadingMore } = get();
      if (!gitLogCommits || !gitLogHasMore || gitLogLoadingMore) return;
      set({ gitLogLoadingMore: true, gitLogLoadMoreFailed: false });
      try {
        const page = await fetchGitLog(gitLogCommits.length);
        set((s) => ({
          gitLogCommits: [...(s.gitLogCommits ?? []), ...page.commits],
          gitLogUpstream: page.upstream,
          gitLogHasMore: page.hasMore,
        }));
      } catch {
        set({ gitLogLoadMoreFailed: true });
      } finally {
        set({ gitLogLoadingMore: false });
      }
    },
  };
}
