import { Input, ListItem } from '@dendelion/paper-ui';
import { SidebarSection } from '../../plans/components/sidebar-section';
import { useDocsSidebar } from '../hooks/use-docs-sidebar';

const simplecaseLabel = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <span className="block px-3 py-1 text-sm italic opacity-[0.35]">{children}</span>
);

export const DocsSidebar = () => {
  const {
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
  } = useDocsSidebar();

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
              onClick={() => selectRepoDoc(f.name)}
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
              onClick={() => selectReleaseVersion(version)}
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
