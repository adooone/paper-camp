import {
  ProjectSwitcher,
  RuntimeUnavailable,
  ServerReloadBanner,
  SidebarShell,
  StackPanel,
  StatusBar,
} from '@/app/components';
import { PageBreadcrumb } from '@/app/components/page-breadcrumb';
import {
  CrossProjectActivityView,
  CrossProjectIdeasView,
  CrossProjectReviewsView,
  HubHome,
  HubShell,
} from '@/app/features/hub';
import { PlanActionsColumn, PlanFilterColumn, PlansPage } from '@/app/features/plans/index';
import { bareId } from '@/app/hooks';
import { useNotificationPush } from '@/app/hooks/use-notification-push';
import { fetchIdeas, fetchPlans } from '@/app/services/content';
import { type ModuleLayer, moduleReadiness } from '@/app/services/module-layer';
import { mountPrefix } from '@/app/services/mount';
import { fetchCapabilities, fetchConfig } from '@/app/services/system';
import {
  Button,
  IconButton,
  Layout,
  Page,
  ToastProvider,
  getSurfaceStyles,
} from '@dendelion/paper-ui';
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAppStore } from './stores/app-store';

const DocsPage = lazy(() =>
  import('@/app/features/docs/index').then((m) => ({ default: m.DocsPage })),
);
const DocsSidebar = lazy(() =>
  import('@/app/features/docs/index').then((m) => ({ default: m.DocsSidebar })),
);
const SettingsPage = lazy(() =>
  import('@/app/features/settings/index').then((m) => ({ default: m.SettingsPage })),
);
const SettingsSidebar = lazy(() =>
  import('@/app/features/settings/index').then((m) => ({ default: m.SettingsSidebar })),
);
const TasksPage = lazy(() =>
  import('@/app/features/tasks/index').then((m) => ({ default: m.TasksPage })),
);
const RoadmapPage = lazy(() =>
  import('@/app/features/roadmap/index').then((m) => ({ default: m.RoadmapPage })),
);
const RoadmapSidebar = lazy(() =>
  import('@/app/features/roadmap/index').then((m) => ({ default: m.RoadmapSidebar })),
);
const StatsPage = lazy(() =>
  import('@/app/features/stats/index').then((m) => ({ default: m.StatsPage })),
);
const GitPage = lazy(() =>
  import('@/app/features/git/index').then((m) => ({ default: m.GitPage })),
);
const GitFileList = lazy(() =>
  import('@/app/features/git/index').then((m) => ({ default: m.GitFileList })),
);
const InboxPage = lazy(() =>
  import('@/app/features/inbox/index').then((m) => ({ default: m.InboxPage })),
);
const IssuesPage = lazy(() =>
  import('@/app/features/issues/index').then((m) => ({ default: m.IssuesPage })),
);

const PROJECTS_PATH = '/projects';
const HUB_PATHS: string[] = [
  PROJECTS_PATH,
  '/projects/reviews',
  '/projects/activity',
  '/projects/ideas',
];

const navItems = [
  { id: 'plans', label: 'Plans', path: '/' },
  { id: 'roadmap', label: 'Roadmap', path: '/roadmap' },
  { id: 'docs', label: 'Docs', path: '/docs' },
  { id: 'issues', label: 'Issues', path: '/issues' },
  { id: 'stats', label: 'Stats', path: '/stats' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];

const NavLabel = ({ item }: { item: (typeof navItems)[number] }) => (
  <span className="inline-flex items-center gap-1.5">{item.label}</span>
);

const SidebarToggleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
  </svg>
);

const STACK_OPEN_KEY = 'stack-open';

function readStoredStackOpen(): boolean {
  try {
    return localStorage.getItem(STACK_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredStackOpen(value: boolean): void {
  try {
    localStorage.setItem(STACK_OPEN_KEY, String(value));
  } catch {
    // localStorage unavailable (e.g. private browsing) — fall back to in-memory only
  }
}

const SIDEBAR_WIDTH = 224;
const STACK_WIDTH = 480;
const MIN_READABLE_PAGE_WIDTH = 495;
const THREE_COLUMN_BREAKPOINT = SIDEBAR_WIDTH + MIN_READABLE_PAGE_WIDTH + STACK_WIDTH;

// Keep in sync with the min-[1199px]:pr-[var(--pc-stack-width)] wrapper (Tailwind needs a literal).
const LARGE_SCREEN_QUERY = `(min-width: ${THREE_COLUMN_BREAKPOINT}px)`;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

const RootLayout = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const loadSuggestions = useAppStore((s) => s.loadSuggestions);
  const loadCapabilities = useAppStore((s) => s.loadCapabilities);
  const loadAgentAuthStatus = useAppStore((s) => s.loadAgentAuthStatus);
  const loadParkedQuestions = useAppStore((s) => s.loadParkedQuestions);
  const loadNotifications = useAppStore((s) => s.loadNotifications);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const checkRuntimeReachable = useAppStore((s) => s.checkRuntimeReachable);
  const runtimeReachable = useAppStore((s) => s.runtimeReachable);
  const runtimeChecking = useAppStore((s) => s.runtimeChecking);
  const githubConfig = useAppStore((s) => s.githubConfig);
  const activeLayer = useRouterState({
    select: (s) => s.matches.at(-1)?.staticData.layer,
  });
  const readiness = moduleReadiness(
    activeLayer,
    { reachable: runtimeReachable, checking: runtimeChecking },
    { githubConfigured: githubConfig !== null },
  );
  const isPlansArea =
    pathname === '/' || pathname.startsWith('/plans/') || pathname.startsWith('/ideas/');
  const isDocsArea = pathname === '/docs' || pathname.startsWith('/docs/');
  const isSettingsArea = pathname === '/settings' || pathname.startsWith('/settings/');
  const isRoadmapArea = pathname === '/roadmap';
  const isGitArea = pathname === '/git';
  const activeId = isPlansArea
    ? 'plans'
    : isDocsArea
      ? 'docs'
      : isSettingsArea
        ? 'settings'
        : navItems.find((item) => item.path === pathname)?.id;
  const hasSidebar = isPlansArea || isDocsArea || isSettingsArea || isRoadmapArea || isGitArea;
  const sidebarAreaKey = isPlansArea
    ? 'plans'
    : isDocsArea
      ? 'docs'
      : isSettingsArea
        ? 'settings'
        : isRoadmapArea
          ? 'roadmap'
          : 'git';
  const [stackOpen, setStackOpen] = useState(readStoredStackOpen);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isLarge = useMediaQuery(LARGE_SCREEN_QUERY);
  const firstRunChecked = useRef(false);

  useNotificationPush();

  useEffect(() => {
    loadSuggestions();
    loadCapabilities();
    loadAgentAuthStatus();
    loadParkedQuestions();
    loadNotifications();
    checkRuntimeReachable();
  }, [
    loadSuggestions,
    loadCapabilities,
    loadAgentAuthStatus,
    loadParkedQuestions,
    loadNotifications,
    checkRuntimeReachable,
  ]);

  // Corpus source depends on runtimeReachable, which a detached client only knows
  // once the probe in the effect above resolves — re-run once it has, so a client
  // that's actually reachable doesn't get stuck on the plan-only GitHub path.
  useEffect(() => {
    if (runtimeChecking) return;
    loadPlans();
    loadIdeas();
  }, [runtimeChecking, loadPlans, loadIdeas]);

  // Land fresh installs (or any install with an incomplete capability) on Setup
  // instead of letting them discover gaps by hitting a broken PR badge or agent button.
  useEffect(() => {
    if (firstRunChecked.current || pathname !== '/') return;
    firstRunChecked.current = true;
    Promise.all([fetchConfig(), fetchCapabilities()]).then(([config, capabilities]) => {
      if (
        !config?.setupDismissed &&
        capabilities !== null &&
        !capabilities.every((c) => c.status === 'ok')
      ) {
        navigate({ to: '/settings/$section', params: { section: 'setup' } });
        return;
      }
      // A corpus at or below `init`'s single seeded example idea (IDEA-1, no plans yet)
      // hasn't been used for real work — point it at USAGE.md instead of an empty Ideas list.
      Promise.all([fetchIdeas(), fetchPlans()]).then(([ideas, plans]) => {
        if (ideas.entries.length > 1 || plans.entries.length > 0) return;
        setActiveDocTitle('USAGE.md');
        navigate({ to: '/docs' });
      });
    });
  }, [pathname, navigate, setActiveDocTitle]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read in the body.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // The hub is a level above the project, so it takes the whole window rather than
  // rendering inside the chrome of a project you have not chosen yet — the
  // cross-project views compose several projects at once, so they belong here too.
  if (HUB_PATHS.includes(pathname)) {
    return (
      <ToastProvider position="bottom-left">
        <HubShell>
          <Outlet />
        </HubShell>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider position="bottom-left">
      <div className="h-screen box-border flex flex-col">
        {/* Only the chrome reserves the Stack's width — the columns below run full
            width so the parchment passes under the panel instead of stopping at it. */}
        <div className="shrink-0 min-[1199px]:pr-[var(--pc-stack-width)]">
          <ServerReloadBanner />
          {/* Full-bleed app bar: identity at the left edge, nav at the right, spanning
              the sidebar and the sheet instead of sitting inside the content column. */}
          <header
            className="pc-app-header flex items-center gap-3 h-[var(--pc-header-h)] max-[480px]:hidden"
            style={getSurfaceStyles({ texture: 'parchment', shade: true })}
          >
            {hasSidebar && (
              <IconButton
                variant="ghost"
                size="small"
                className="lg:hidden"
                label="Open sidebar"
                onClick={() => setMobileSidebarOpen(true)}
                icon={<SidebarToggleIcon />}
              />
            )}
            <ProjectSwitcher />
            <nav aria-label="Main navigation" className="flex items-center gap-1 ml-auto">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="small"
                  isActive={item.id === activeId}
                  onClick={() => navigate({ to: item.path })}
                  aria-current={item.id === activeId ? 'page' : undefined}
                >
                  <NavLabel item={item} />
                </Button>
              ))}
            </nav>
          </header>
          {/* Ambient status sits under the app bar: a rail belonging to the chrome
              above the work surface, not a band competing with it for the top edge. */}
          <StatusBar />
        </div>
        <Layout
          style={{ flex: '1 1 0%', minHeight: 0, height: 'auto' }}
          background={{ texture: 'speckle', ruledType: 'grid', ruledColor: 'blue' }}
          // Explicit false: paper-ui defaults it to true, and an empty header still
          // renders a 64px band that pushes the parchment down.
          showHeader={false}
          showSidebar={false}
          showPage={false}
          bleedBottom
        >
          <div className="flex flex-col h-full min-h-0">
            {/* Bled out of `.content`'s padding: the scrollbar renders at this box's
                edge, so content isn't inset by a strip that no longer exists. */}
            <div
              // No top inset: there's no header band above the columns anymore, so the
              // page should meet the top of the viewport directly. Page's own 2rem padding
              // still holds the text off the edge — re-adding it here would stack two grid
              // cells of dead space.
              // paddingBottom uses var() so utilities.css can widen it below the phone
              // breakpoint, clearing the fixed .phone-bottom-nav that replaces the header
              // nav there.
              className="flex flex-1 min-h-0 justify-center items-start box-border overflow-y-auto [scrollbar-gutter:stable] -mt-8 -ml-8 -mr-8 pt-0 pl-8 pr-8 pb-[var(--pc-content-pad-bottom)]"
            >
              {/* --pc-sidebar-h: the sticky sidebar can't size off this group (it's as
                  tall as the page). lg only — below that it's a full-height drawer. */}
              <div className="flex min-w-0 justify-center lg:[--pc-sidebar-h:calc(100vh-160px)] gap-6 w-full min-h-full">
                {hasSidebar && (
                  <SidebarShell
                    routeKey={sidebarAreaKey}
                    mobileOpen={mobileSidebarOpen}
                    onMobileClose={() => setMobileSidebarOpen(false)}
                  >
                    {isPlansArea && (
                      <>
                        <PlanFilterColumn />
                        <PlanActionsColumn />
                      </>
                    )}
                    {isDocsArea && (
                      <Suspense fallback={null}>
                        <DocsSidebar />
                      </Suspense>
                    )}
                    {isSettingsArea && (
                      <Suspense fallback={null}>
                        <SettingsSidebar />
                      </Suspense>
                    )}
                    {isRoadmapArea && (
                      <Suspense fallback={null}>
                        <RoadmapSidebar />
                      </Suspense>
                    )}
                    {isGitArea && (
                      <Suspense fallback={null}>
                        <GitFileList />
                      </Suspense>
                    )}
                  </SidebarShell>
                )}
                <div className="relative flex flex-col min-w-0 flex-[1_1_0%]">
                  {/* Its own band above the sheet rather than a pill floating on it. `shade`
                      is the same parchment grain one step darker, so the seam reads as a
                      fold in one surface instead of a different material. */}
                  <div className="flex flex-col flex-1 min-w-0">
                    {/* width is load-bearing: `.page`'s `margin: 0 auto` suppresses flex
                        stretch, so without it the sheet sizes to its content. */}
                    <Page
                      texture={{ texture: 'parchment' }}
                      rounded="none"
                      className="pc-page w-full max-w-none"
                    >
                      {readiness === 'unreachable' ? (
                        <RuntimeUnavailable layer={activeLayer} />
                      ) : readiness === 'checking' ? null : (
                        <Suspense fallback={null}>
                          <PageBreadcrumb />
                          <Outlet />
                        </Suspense>
                      )}
                    </Page>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Layout>
      </div>
      <StackPanel
        open={stackOpen}
        pinned={isLarge}
        onToggle={() => {
          // Updaters must be pure — StrictMode double-invokes them.
          const next = !stackOpen;
          writeStoredStackOpen(next);
          setStackOpen(next);
        }}
      />
      {/* Header's nav row (max-[480px]:hidden above) has nowhere to wrap below the
          phone breakpoint — this fixed bottom bar replaces it, reachable one-handed. */}
      <nav
        aria-label="Main navigation"
        className="hidden max-[480px]:flex max-[480px]:fixed max-[480px]:left-0 max-[480px]:right-0 max-[480px]:bottom-0 max-[480px]:z-[250] max-[480px]:items-stretch max-[480px]:justify-around max-[480px]:gap-1 max-[480px]:py-2 max-[480px]:px-2 max-[480px]:[padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))] max-[480px]:bg-[var(--pui-bg-base,#fff)] max-[480px]:border-t max-[480px]:border-black/10 max-[480px]:shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
      >
        {hasSidebar && (
          <IconButton
            variant="ghost"
            size="small"
            label="Open sidebar"
            onClick={() => setMobileSidebarOpen(true)}
            icon={<SidebarToggleIcon />}
            className="min-h-11"
          />
        )}
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="small"
            isActive={item.id === activeId}
            onClick={() => navigate({ to: item.path })}
            aria-current={item.id === activeId ? 'page' : undefined}
            className="min-h-11"
          >
            <NavLabel item={item} />
          </Button>
        ))}
      </nav>
    </ToastProvider>
  );
};

const rootRoute = createRootRoute({ component: RootLayout });

// The hub's own page, reachable whether or not a project is open — the shell in
// main.tsx only covers the case where none is, which a locally served bundle never
// hits. Registry state is device-local, so this needs no runtime and no corpus.
const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: HubHome,
  staticData: { layer: 'client' },
});

// Composed by fanning out across every registered runtime directly, so none of
// these need this client's own runtime — only whichever projects answer.
const projectReviewsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/reviews',
  component: CrossProjectReviewsView,
  staticData: { layer: 'client' },
});
const projectActivityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/activity',
  component: CrossProjectActivityView,
  staticData: { layer: 'client' },
});
const projectIdeasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/ideas',
  component: CrossProjectIdeasView,
  staticData: { layer: 'client' },
});

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlansPage,
  validateSearch: (search: Record<string, unknown>): { subject?: string } => ({
    subject: typeof search.subject === 'string' ? search.subject : undefined,
  }),
  staticData: { layer: 'corpus' },
});
// `/plans/:id` was the old address for the same page. Kept as a redirect so links
// already shared or bookmarked don't 404.
const legacyPlanDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans/$planId',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/ideas/$ideaId',
      params: { ideaId: bareId(params.planId) ?? params.planId },
    });
  },
});
const ideaDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ideas/$ideaId',
  component: PlansPage,
  staticData: { layer: 'corpus' },
});
const ticketDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ideas/$ideaId/tickets/$ticketId',
  component: PlansPage,
  staticData: { layer: 'corpus' },
});
const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsPage,
  staticData: { layer: 'runtime' },
});
const docsSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/$section',
  component: DocsPage,
  staticData: { layer: 'runtime' },
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
  staticData: { layer: 'runtime' },
});
const settingsSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/$section',
  component: SettingsPage,
  staticData: { layer: 'runtime' },
});

const roadmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/roadmap',
  component: RoadmapPage,
  validateSearch: (search: Record<string, unknown>): { item?: string } => ({
    item: typeof search.item === 'string' ? search.item : undefined,
  }),
  staticData: { layer: 'runtime' },
});

const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: InboxPage,
  staticData: { layer: 'runtime' },
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  component: StatsPage,
  staticData: { layer: 'runtime' },
});

const gitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/git',
  component: GitPage,
  staticData: { layer: 'runtime' },
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  component: TasksPage,
  validateSearch: (search: Record<string, unknown>): { taskId?: string } => ({
    taskId: typeof search.taskId === 'string' ? search.taskId : undefined,
  }),
  staticData: { layer: 'runtime' },
});

const issuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/issues',
  component: IssuesPage,
  staticData: { layer: 'runtime' },
});

const routeTree = rootRoute.addChildren([
  plansRoute,
  projectsRoute,
  projectReviewsRoute,
  projectActivityRoute,
  projectIdeasRoute,
  legacyPlanDetailRoute,
  ideaDetailRoute,
  ticketDetailRoute,
  docsRoute,
  docsSectionRoute,
  settingsRoute,
  settingsSectionRoute,
  tasksRoute,
  issuesRoute,
  roadmapRoute,
  statsRoute,
  inboxRoute,
  gitRoute,
]);

export const router = createRouter({ routeTree, basepath: mountPrefix || '/' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    layer?: ModuleLayer;
  }
}
