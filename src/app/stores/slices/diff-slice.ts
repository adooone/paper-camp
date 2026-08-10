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
  };
}
