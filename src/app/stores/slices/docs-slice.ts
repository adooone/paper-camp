import { loadProjectResource } from '../project-resources';
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
      if (!(await loadProjectResource(set, 'repo-docs'))) return;
      const { activeDocTitle, repoDocs } = get();
      if (activeDocTitle) return;
      const readme = ['MAIN.md', 'README.md'].find((name) => repoDocs.some((f) => f.name === name));
      if (readme) set({ activeDocTitle: readme });
    },

    setActiveDocTitle: (title) => set({ activeDocTitle: title }),

    setDocSearchQuery: (query) => set({ docSearchQuery: query }),

    loadReleaseVersions: async () => {
      await loadProjectResource(set, 'release-versions');
    },

    setActiveReleaseVersion: (version) => set({ activeReleaseVersion: version }),
  };
}
