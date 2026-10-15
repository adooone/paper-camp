import { useResolvedDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const useDocsSidebar = () => {
  const repoDocs = useAppStore((s) => s.repoDocs);
  const repoDocsLoading = useAppStore((s) => s.repoDocsLoading);
  const loadRepoDocs = useAppStore((s) => s.loadRepoDocs);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const docSearchQuery = useAppStore((s) => s.docSearchQuery);
  const setDocSearchQuery = useAppStore((s) => s.setDocSearchQuery);
  const releaseVersions = useAppStore((s) => s.releaseVersions);
  const releaseVersionsLoading = useAppStore((s) => s.releaseVersionsLoading);
  const loadReleaseVersions = useAppStore((s) => s.loadReleaseVersions);
  const activeDocSection = useResolvedDocSection();
  const navigate = useNavigate();

  useEffect(() => {
    loadRepoDocs();
  }, [loadRepoDocs]);

  useEffect(() => {
    loadReleaseVersions();
  }, [loadReleaseVersions]);

  const selectRepoDoc = (name: string) => {
    navigate({ to: '/project/docs/$section', params: { section: 'repo-docs' } });
    setActiveDocTitle(name);
  };

  const openReleases = () =>
    navigate({ to: '/project/docs/$section', params: { section: 'release-notes' } });

  return {
    repoDocs,
    repoDocsLoading,
    activeDocTitle,
    docSearchQuery,
    setDocSearchQuery,
    releaseVersions,
    releaseVersionsLoading,
    activeDocSection,
    selectRepoDoc,
    openReleases,
  };
};
