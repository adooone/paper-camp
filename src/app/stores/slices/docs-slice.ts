import { fetchRepoDocs } from '../../services/content';
import { fetchReleaseVersions } from '../../services/release-notes-api';
import type { GetState, SetState } from './slice-helpers';

export type DocsSlice = {
  repoDocs: { name: string; content: string }[];
  repoDocsLoading: boolean;
  loadRepoDocs: () => Promise<void>;

  activeDocTitle: string | null;
  setActiveDocTitle: (title: string | null) => void;

  docSearchQuery: string;
  setDocSearchQuery: (query: string) => void;

  releaseVersions: string[];
  releaseVersionsLoading: boolean;
  loadReleaseVersions: () => Promise<void>;

  activeReleaseVersion: string | null;
  setActiveReleaseVersion: (version: string | null) => void;
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

    releaseVersions: [],
    releaseVersionsLoading: true,
    loadReleaseVersions: async () => {
      set({ releaseVersionsLoading: true });
      try {
        const versions = await fetchReleaseVersions();
        set({ releaseVersions: versions, releaseVersionsLoading: false });
      } catch {
        set({ releaseVersions: [], releaseVersionsLoading: false });
      }
    },

    activeReleaseVersion: null,
    setActiveReleaseVersion: (version) => set({ activeReleaseVersion: version }),
  };
}
