import { useResolvedDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { Input, ListItem } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { SidebarSection } from '../../plans/components/sidebar-section';

const simplecaseLabel = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <span className="block px-3 py-1 text-sm italic opacity-[0.35]">{children}</span>
);

export const DocsSidebar = () => {
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

  return (
    <>
      <div className="flex h-[64px] items-center">
        <Input
          size="small"
          aria-label="Search docs"
          placeholder="Search docs…"
          value={docSearchQuery}
          onChange={(e) => setDocSearchQuery(e.target.value)}
        />
      </div>

      <SidebarSection label="Repo Docs">
        {repoDocsLoading && repoDocs.length === 0 ? (
          <EmptyState>Loading…</EmptyState>
        ) : repoDocs.length > 0 ? (
          repoDocs.map((f) => (
            <ListItem
              key={f.name}
              size="small"
              className="pc-row text-xs"
              active={activeDocSection === 'repo-docs' && activeDocTitle === f.name}
              onClick={() => {
                navigate({ to: '/docs/$section', params: { section: 'repo-docs' } });
                setActiveDocTitle(f.name);
              }}
            >
              {simplecaseLabel(f.name)}
            </ListItem>
          ))
        ) : (
          <EmptyState>No repo docs found</EmptyState>
        )}
      </SidebarSection>

      <SidebarSection label="Releases">
        {releaseVersionsLoading && releaseVersions.length === 0 ? (
          <EmptyState>Loading…</EmptyState>
        ) : releaseVersions.length > 0 ? (
          releaseVersions.map((version) => (
            <ListItem
              key={version}
              size="small"
              className="pc-row text-xs"
              active={activeDocSection === 'release-notes' && activeReleaseVersion === version}
              onClick={() => {
                navigate({ to: '/docs/$section', params: { section: 'release-notes' } });
                setActiveReleaseVersion(version);
              }}
            >
              {version}
            </ListItem>
          ))
        ) : (
          <EmptyState>No releases yet</EmptyState>
        )}
      </SidebarSection>
    </>
  );
};
