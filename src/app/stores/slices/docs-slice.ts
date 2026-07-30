import { fetchRepoDocs } from '../../services/content';
import type { GetState, SetState } from './slice-helpers';

export type DocsSlice = {
  repoDocs: { name: string; content: string }[];
  repoDocsLoading: boolean;
  loadRepoDocs: () => Promise<void>;

  activeDocTitle: string | null;
  setActiveDocTitle: (title: string | null) => void;

  docSearchQuery: string;
  setDocSearchQuery: (query: string) => void;
};

export function createDocsSlice(set: SetState, get: GetState): DocsSlice {
  return {
    repoDocs: [],
    repoDocsLoading: true,
    loadRepoDocs: async () => {
      set({ repoDocsLoading: true });
      try {
        const data = await fetchRepoDocs();
        set({ repoDocs: data.files, repoDocsLoading: false });
        const { activeDocTitle } = get();
        if (!activeDocTitle) {
          const readme = ['MAIN.md', 'README.md'].find((name) =>
            data.files.some((f) => f.name === name),
          );
          if (readme) set({ activeDocTitle: readme });
        }
      } catch {
        set({ repoDocs: [], repoDocsLoading: false });
      }
    },

    activeDocTitle: null,
    setActiveDocTitle: (title) => set({ activeDocTitle: title }),

    docSearchQuery: '',
    setDocSearchQuery: (query) => set({ docSearchQuery: query }),
  };
}
