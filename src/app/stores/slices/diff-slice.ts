import { fetchFileDiffs } from '@/app/services/git-api';
import type { FileDiffEntry } from '@/types/index';
import type { SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type DiffSlice = {
  // Lifted here (not local page state) so the router-level sidebar and the page share one source.
  diffFiles: FileDiffEntry[] | null;
  diffLoadFailed: boolean;
  loadDiffFiles: () => Promise<void>;
};

export function createDiffSlice(set: SetState): DiffSlice {
  return {
    diffFiles: null,
    diffLoadFailed: false,
    loadDiffFiles: loadSlice(
      set,
      fetchFileDiffs,
      (files) => ({ diffFiles: files, diffLoadFailed: false }),
      () => ({ diffLoadFailed: true }),
    ),
  };
}
