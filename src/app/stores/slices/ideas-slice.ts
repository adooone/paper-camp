import { refreshIdeas, refreshPlans } from '@/app/services/query-client';
import type { ArchivableIdea } from '@/types/index';
import { archiveIdeas as archiveIdeasApi, fetchArchivableIdeas } from '../../services/content';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type IdeasSlice = {
  archivableIdeas: ArchivableIdea[];
  loadArchivableIdeas: () => Promise<void>;
  archiveIdeas: (ids: string[]) => Promise<void>;
};

export function createIdeasSlice(set: SetState, get: GetState): IdeasSlice {
  return {
    archivableIdeas: [],
    loadArchivableIdeas: loadSlice(
      set,
      fetchArchivableIdeas,
      (entries) => ({ archivableIdeas: entries }),
      () => ({ archivableIdeas: [] }),
    ),
    archiveIdeas: async (ids) => {
      await archiveIdeasApi(ids);
      await Promise.all([get().loadArchivableIdeas(), refreshPlans(), refreshIdeas()]);
    },
  };
}
