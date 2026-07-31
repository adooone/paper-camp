import type { ArchivableIdea, IdeaEntry } from '@/types/index';
import {
  archiveIdeas as archiveIdeasApi,
  fetchArchivableIdeas,
  fetchIdeas,
} from '../../services/content';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type IdeasSlice = {
  ideaEntries: IdeaEntry[];
  loadIdeas: () => Promise<void>;

  archivableIdeas: ArchivableIdea[];
  loadArchivableIdeas: () => Promise<void>;
  archiveIdeas: (ids: string[]) => Promise<void>;
};

export function createIdeasSlice(set: SetState, get: GetState): IdeasSlice {
  return {
    ideaEntries: [],
    loadIdeas: loadSlice(
      set,
      fetchIdeas,
      (result) => ({ ideaEntries: result.entries }),
      () => ({ ideaEntries: [] }),
    ),

    archivableIdeas: [],
    loadArchivableIdeas: loadSlice(
      set,
      fetchArchivableIdeas,
      (entries) => ({ archivableIdeas: entries }),
      () => ({ archivableIdeas: [] }),
    ),
    archiveIdeas: async (ids) => {
      await archiveIdeasApi(ids);
      await Promise.all([get().loadArchivableIdeas(), get().loadPlans(), get().loadIdeas()]);
    },
  };
}
