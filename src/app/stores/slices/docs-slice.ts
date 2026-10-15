import { fetchRepoDocs } from '../../services/content';
import { fetchReleaseVersions } from '../../services/release-notes-api';
import type { GetState, SetState } from './slice-helpers';

export function createInitialDocsState() {
  return {
    repoDocs: [] as { name: string; content: string }[],
    repoDocsLoading: true,
    activeDocTitle: null as string | null,
    docSearchQuery: '',
    releaseVersions: [] as string[],
    releaseVersionsLoading: true,
    activeReleaseVersion: null as string | null,
  };
}

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
    ...createInitialDocsState(),
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

    setActiveDocTitle: (title) => set({ activeDocTitle: title }),

    setDocSearchQuery: (query) => set({ docSearchQuery: query }),

    loadReleaseVersions: async () => {
      set({ releaseVersionsLoading: true });
      try {
        const versions = await fetchReleaseVersions();
        set({ releaseVersions: versions, releaseVersionsLoading: false });
      } catch {
        set({ releaseVersions: [], releaseVersionsLoading: false });
      }
    },

    setActiveReleaseVersion: (version) => set({ activeReleaseVersion: version }),
  };
}
