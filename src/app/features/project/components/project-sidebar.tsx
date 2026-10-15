import { CheckboxFilterRow, SidebarSection } from '@/app/components';
import { useDocsSidebar } from '@/app/features/docs/hooks';
import { stripHorizonPrefix, useRoadmapSidebar } from '@/app/features/roadmap';
import { ProjectsInView } from '@/app/features/scope/index';
import { useActiveSettingsSection } from '@/app/hooks';
import { EmptyState, Input, SidebarItem, SidebarLabel, Skeleton } from '@dendelion/paper-ui';
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router';

const simplecaseLabel = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const SETTINGS_ITEMS: { section: string | null; label: string }[] = [
  { section: null, label: 'Project Info' },
  { section: 'setup', label: 'Setup' },
  { section: 'merge-policy', label: 'Merge Policy' },
  { section: 'toolbar', label: 'Toolbar' },
  { section: 'desk', label: 'Desk' },
  { section: 'night', label: 'Review passes' },
  { section: 'notifications', label: 'Notifications' },
];

export const ProjectSidebar = () => {
  const {
    repoDocs,
    repoDocsLoading,
    activeDocTitle,
    docSearchQuery,
    setDocSearchQuery,
    selectRepoDoc,
    openReleases,
  } = useDocsSidebar();
  const settingsSection = useActiveSettingsSection();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { section: routeSection } = useParams({ strict: false }) as { section?: string };
  const navigate = useNavigate();
  const isDocsPath = pathname.startsWith('/project/docs');
  const docSection = isDocsPath ? routeSection : undefined;
  const isSettingsPath = pathname.startsWith('/project/settings');
  const isStatsPath = pathname === '/project' || pathname.startsWith('/project/stats');
  const isRoadmapPath = pathname.startsWith('/project/roadmap');
  const { horizonTitles, horizonCounts, activeHorizons, toggleRoadmapHorizon } =
    useRoadmapSidebar();

  return (
    <>
      <ProjectsInView mode="switcher" countKind={null} />
      <SidebarSection>
        <SidebarLabel>Settings</SidebarLabel>
        <div className="flex flex-col">
          {SETTINGS_ITEMS.map((item) => (
            <SidebarItem
              key={item.label}
              active={isSettingsPath && settingsSection === item.section}
              onClick={() =>
                item.section
                  ? navigate({
                      to: '/project/settings/$section',
                      params: { section: item.section },
                    })
                  : navigate({ to: '/project/settings' })
              }
            >
              {item.label}
            </SidebarItem>
          ))}
        </div>
      </SidebarSection>
      <SidebarSection>
        <SidebarLabel>Roadmap</SidebarLabel>
        <div className="flex flex-col">
          <SidebarItem active={isRoadmapPath} onClick={() => navigate({ to: '/project/roadmap' })}>
            Overview
          </SidebarItem>
          {horizonTitles.map((title) => (
            <CheckboxFilterRow
              key={title}
              label={stripHorizonPrefix(title)}
              checked={activeHorizons.has(title)}
              count={horizonCounts[title] ?? 0}
              ariaLabel={`${activeHorizons.has(title) ? 'Hide' : 'Show'} ${stripHorizonPrefix(title)}`}
              onChange={() => toggleRoadmapHorizon(title)}
            />
          ))}
        </div>
      </SidebarSection>
      <SidebarSection>
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
        <div className="flex flex-col">
          {repoDocsLoading && repoDocs.length === 0 ? (
            <span className="block px-3 py-1">
              <Skeleton variant="text" width="60%" />
            </span>
          ) : repoDocs.length > 0 ? (
            repoDocs.map((f) => (
              <SidebarItem
                key={f.name}
                active={docSection === 'repo-docs' && activeDocTitle === f.name}
                onClick={() => selectRepoDoc(f.name)}
              >
                {simplecaseLabel(f.name)}
              </SidebarItem>
            ))
          ) : (
            <EmptyState message="No repo docs found" />
          )}
          <SidebarItem active={docSection === 'release-notes'} onClick={openReleases}>
            Releases
          </SidebarItem>
        </div>
      </SidebarSection>
      <SidebarSection>
        <SidebarLabel>Stats</SidebarLabel>
        <div className="flex flex-col">
          <SidebarItem active={isStatsPath} onClick={() => navigate({ to: '/project/stats' })}>
            Overview
          </SidebarItem>
        </div>
      </SidebarSection>
    </>
  );
};
