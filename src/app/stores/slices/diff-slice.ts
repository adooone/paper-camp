import { fetchFileDiffs } from '@/app/services/git-api';
import type { FileDiffEntry } from '@/types/index';
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
  };
}
