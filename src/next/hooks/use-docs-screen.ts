import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/app/stores/app-store';
import { type DocMatch, type RepoDoc, searchDocs } from '../shell/docs-model';

export interface DocsScreenState {
  load: 'loading' | 'ready';
  docs: RepoDoc[];
  releaseVersions: string[];
  releasesLoading: boolean;
  query: string;
  setQuery: (query: string) => void;
  matches: DocMatch[];
}

export function useDocsScreen(): DocsScreenState {
  const docs = useAppStore((state) => state.repoDocs);
  const loading = useAppStore((state) => state.repoDocsLoading);
  const releaseVersions = useAppStore((state) => state.releaseVersions);
  const releasesLoading = useAppStore((state) => state.releaseVersionsLoading);
  const loadRepoDocs = useAppStore((state) => state.loadRepoDocs);
  const loadReleaseVersions = useAppStore((state) => state.loadReleaseVersions);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadRepoDocs();
    void loadReleaseVersions();
  }, [loadRepoDocs, loadReleaseVersions]);

  return useMemo(
    () => ({
      load: loading && docs.length === 0 ? 'loading' : 'ready',
      docs,
      releaseVersions,
      releasesLoading,
      query,
      setQuery,
      matches: searchDocs(docs, query),
    }),
    [loading, docs, releaseVersions, releasesLoading, query],
  );
}
