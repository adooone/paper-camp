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
  const activeReleaseVersion = useAppStore((s) => s.activeReleaseVersion);
  const setActiveReleaseVersion = useAppStore((s) => s.setActiveReleaseVersion);
  const activeDocSection = useResolvedDocSection();
  const navigate = useNavigate();

  useEffect(() => {
    loadRepoDocs();
  }, [loadRepoDocs]);

  useEffect(() => {
    loadReleaseVersions();
  }, [loadReleaseVersions]);

  const selectRepoDoc = (name: string) => {
    navigate({ to: '/docs/$section', params: { section: 'repo-docs' } });
    setActiveDocTitle(name);
  };

  const selectReleaseVersion = (version: string) => {
    navigate({ to: '/docs/$section', params: { section: 'release-notes' } });
    setActiveReleaseVersion(version);
  };

  return {
    repoDocs,
    repoDocsLoading,
    activeDocTitle,
    docSearchQuery,
    setDocSearchQuery,
    releaseVersions,
    releaseVersionsLoading,
    activeReleaseVersion,
    activeDocSection,
    selectRepoDoc,
    selectReleaseVersion,
  };
};
