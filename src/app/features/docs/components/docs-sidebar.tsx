import { EmptyState } from '@/app/components';
import { Input, ListItem } from '@dendelion/paper-ui';
import { SidebarSection } from '../../plans/components/sidebar-section';
import { useDocsSidebar } from '../hooks';

const simplecaseLabel = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

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
          <span className="block px-3 py-1 text-xs opacity-50">Loading…</span>
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
          <EmptyState message="No repo docs found" />
        )}
      </SidebarSection>

      <SidebarSection label="Releases">
        {releaseVersionsLoading && releaseVersions.length === 0 ? (
          <span className="block px-3 py-1 text-xs opacity-50">Loading…</span>
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
          <EmptyState message="No releases yet" />
        )}
      </SidebarSection>
    </>
  );
};
