import { useDocsSidebar } from '@/app/features/docs/hooks';
import { ProjectsInView } from '@/app/features/scope/index';
import { useActiveSettingsSection } from '@/app/hooks';
import {
  EmptyState,
  Input,
  SidebarCard,
  SidebarItem,
  SidebarLabel,
  Skeleton,
} from '@dendelion/paper-ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';

const simplecaseLabel = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

export const ProjectSidebar = () => {
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
  const settingsSection = useActiveSettingsSection();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isDocsPath = pathname.startsWith('/project/docs');
  const isSettingsPath = pathname.startsWith('/project/settings');
  const isStatsPath = pathname === '/project' || pathname.startsWith('/project/stats');

  return (
    <>
      <ProjectsInView mode="switcher" countKind={null} />
      <SidebarCard className="shrink-0">
        <SidebarLabel>Docs</SidebarLabel>
        <div className="px-1 pt-1 pb-2">
          <Input
            size="small"
            className="w-full"
            aria-label="Search docs"
            placeholder="Search docs…"
            value={docSearchQuery}
            onChange={(e) => setDocSearchQuery(e.target.value)}
          />
        </div>
        <SidebarLabel>Repo Docs</SidebarLabel>
        <div className="flex flex-col">
          {repoDocsLoading && repoDocs.length === 0 ? (
            <span className="block px-3 py-1">
              <Skeleton variant="text" width="60%" />
            </span>
          ) : repoDocs.length > 0 ? (
            repoDocs.map((f) => (
              <SidebarItem
                key={f.name}
                active={isDocsPath && activeDocSection === 'repo-docs' && activeDocTitle === f.name}
                onClick={() => selectRepoDoc(f.name)}
              >
                {simplecaseLabel(f.name)}
              </SidebarItem>
            ))
          ) : (
            <EmptyState message="No repo docs found" />
          )}
        </div>
        <SidebarLabel>Releases</SidebarLabel>
        <div className="flex flex-col">
          {releaseVersionsLoading && releaseVersions.length === 0 ? (
            <span className="block px-3 py-1">
              <Skeleton variant="text" width="60%" />
            </span>
          ) : releaseVersions.length > 0 ? (
            releaseVersions.map((version) => (
              <SidebarItem
                key={version}
                active={
                  isDocsPath &&
                  activeDocSection === 'release-notes' &&
                  activeReleaseVersion === version
                }
                onClick={() => selectReleaseVersion(version)}
              >
                {version}
              </SidebarItem>
            ))
          ) : (
            <EmptyState message="No releases yet" />
          )}
        </div>

        <SidebarLabel>Stats</SidebarLabel>
        <div className="flex flex-col">
          <SidebarItem active={isStatsPath} onClick={() => navigate({ to: '/project/stats' })}>
            Overview
          </SidebarItem>
        </div>

        <SidebarLabel>Settings</SidebarLabel>
        <div className="flex flex-col">
          <SidebarItem
            active={isSettingsPath && settingsSection === null}
            onClick={() => navigate({ to: '/project/settings' })}
          >
            Project Info
          </SidebarItem>
          <SidebarItem
            active={isSettingsPath && settingsSection === 'setup'}
            onClick={() =>
              navigate({ to: '/project/settings/$section', params: { section: 'setup' } })
            }
          >
            Setup
          </SidebarItem>
          <SidebarItem
            active={isSettingsPath && settingsSection === 'merge-policy'}
            onClick={() =>
              navigate({ to: '/project/settings/$section', params: { section: 'merge-policy' } })
            }
          >
            Merge Policy
          </SidebarItem>
          <SidebarItem
            active={isSettingsPath && settingsSection === 'toolbar'}
            onClick={() =>
              navigate({ to: '/project/settings/$section', params: { section: 'toolbar' } })
            }
          >
            Toolbar
          </SidebarItem>
          <SidebarItem
            active={isSettingsPath && settingsSection === 'desk'}
            onClick={() =>
              navigate({ to: '/project/settings/$section', params: { section: 'desk' } })
            }
          >
            Desk
          </SidebarItem>
          <SidebarItem
            active={isSettingsPath && settingsSection === 'night'}
            onClick={() =>
              navigate({ to: '/project/settings/$section', params: { section: 'night' } })
            }
          >
            Review passes
          </SidebarItem>
          <SidebarItem
            active={isSettingsPath && settingsSection === 'notifications'}
            onClick={() =>
              navigate({ to: '/project/settings/$section', params: { section: 'notifications' } })
            }
          >
            Notifications
          </SidebarItem>
        </div>
      </SidebarCard>
    </>
  );
};
