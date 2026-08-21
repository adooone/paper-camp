import {
  type GithubCorpusConfig,
  clearGithubConfig as clearStoredGithubConfig,
  readGithubConfig,
  writeGithubConfig,
} from '@/app/services/github/config-store';
import type { SetState } from './slice-helpers';

export type GithubSlice = {
  githubConfig: GithubCorpusConfig | null;
  setGithubConfig: (config: GithubCorpusConfig) => void;
  clearGithubConfig: () => void;
};

export function createGithubSlice(set: SetState): GithubSlice {
  return {
    githubConfig: readGithubConfig(),
    setGithubConfig: (config) => {
      writeGithubConfig(config);
      set({ githubConfig: config });
    },
    clearGithubConfig: () => {
      clearStoredGithubConfig();
      set({ githubConfig: null });
    },
  };
}
