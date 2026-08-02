import {
  ProjectIdentityHeader,
  ServerReloadBanner,
  SidebarShell,
  StackPanel,
  StatusBar,
} from '@/app/components';
import { PlanActionsColumn, PlanFilterColumn, PlansPage } from '@/app/features/plans/index';
import { fetchIdeas, fetchPlans } from '@/app/services/content';
import { fetchCapabilities, fetchConfig } from '@/app/services/system';
import { Button, IconButton, Layout, Page, ToastProvider } from '@dendelion/paper-ui';
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAppStore } from './stores/app-store';
import { crossfadeTransition, crossfadeVariants } from './styles/motion';

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
const DiffPage = lazy(() =>
  import('@/app/features/diff/index').then((m) => ({ default: m.DiffPage })),
);
const StatsPage = lazy(() =>
  import('@/app/features/stats/index').then((m) => ({ default: m.StatsPage })),
);

const navItems = [
  { id: 'plans', label: 'Plans', path: '/' },
  { id: 'roadmap', label: 'Roadmap', path: '/roadmap' },
  { id: 'docs', label: 'Docs', path: '/docs' },
  { id: 'tasks', label: 'Tasks', path: '/tasks' },
  { id: 'stats', label: 'Stats', path: '/stats' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];

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

// Keep in sync with the min-[1440px]:pr-[480px] wrapper (Tailwind needs a literal).
const LARGE_SCREEN_QUERY = '(min-width: 1440px)';

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
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const isPlansArea =
    pathname === '/' || pathname.startsWith('/plans/') || pathname.startsWith('/ideas/');
  const isDocsArea = pathname === '/docs' || pathname.startsWith('/docs/');
  const isSettingsArea = pathname === '/settings' || pathname.startsWith('/settings/');
  const activeId = isPlansArea
    ? 'plans'
    : isDocsArea
      ? 'docs'
      : isSettingsArea
        ? 'settings'
        : navItems.find((item) => item.path === pathname)?.id;
  const hasSidebar = isPlansArea || isDocsArea || isSettingsArea;
  const sidebarAreaKey = isPlansArea ? 'plans' : isDocsArea ? 'docs' : 'settings';
  const [stackOpen, setStackOpen] = useState(readStoredStackOpen);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const isLarge = useMediaQuery(LARGE_SCREEN_QUERY);
  const firstRunChecked = useRef(false);

  useEffect(() => {
    loadPlans();
    loadIdeas();
    loadSuggestions();
    loadCapabilities();
    loadAgentAuthStatus();
  }, [loadPlans, loadIdeas, loadSuggestions, loadCapabilities, loadAgentAuthStatus]);

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

  return (
    <ToastProvider position="bottom-left">
      <div className="h-screen box-border min-[1440px]:pr-[480px] flex flex-col">
        <ServerReloadBanner />
        <StatusBar />
        <Layout
          style={{ flex: '1 1 0%', minHeight: 0, height: 'auto' }}
          background={{ texture: 'speckle', ruledType: 'grid', ruledColor: 'blue' }}
          showHeader
          showSidebar={false}
          showPage={false}
          bleedBottom
          headerActions={
            <>
              {hasSidebar && (
                <IconButton
                  variant="ghost"
                  size="small"
                  className="lg:hidden max-[480px]:hidden"
                  label="Open sidebar"
                  onClick={() => setMobileSidebarOpen(true)}
                  icon={<SidebarToggleIcon />}
                />
              )}
              <ProjectIdentityHeader size="sm" />
              <div className="flex-1" />
              <nav
                aria-label="Main navigation"
                className="flex items-center gap-1 max-[480px]:hidden"
              >
                {navItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="small"
                    isActive={item.id === activeId}
                    onClick={() => navigate({ to: item.path })}
                    aria-current={item.id === activeId ? 'page' : undefined}
                  >
                    {item.label}
                  </Button>
                ))}
              </nav>
            </>
          }
        >
          <div className="flex flex-col h-full min-h-0">
            {/* Bled out of `.content`'s padding: the scrollbar renders at this box's
                edge, and content should pass under the header/strip, not stop short. */}
            <div
              // No top inset: the header no longer paints a background, so the page
              // should meet it directly. Page's own 2rem padding still holds the text
              // off the edge — re-adding it here stacked two grid cells of dead space.
              // paddingBottom uses var() so utilities.css can widen it below the phone
              // breakpoint, clearing the fixed .phone-bottom-nav that replaces the header
              // nav there. 32px mirrors paper-ui `.content`'s padding, which the strip
              // and scroller bleed back out of.
              className="flex flex-1 min-h-0 justify-center items-start box-border overflow-y-auto -mt-8 -ml-8 -mr-8 pt-0 pl-8 pr-8 pb-[var(--pc-content-pad-bottom,32px)]"
            >
              {/* --pc-sidebar-h: the sticky sidebar can't size off this group (it's as
                  tall as the page). lg only — below that it's a full-height drawer. */}
              <div className="flex min-w-0 justify-center lg:[--pc-sidebar-h:calc(100vh-160px)] gap-6 w-full">
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
                  </SidebarShell>
                )}
                <div
                  className={`flex flex-col min-w-0 ${isLarge ? 'flex-[1_1_0%]' : 'flex-[0_1_800px]'}`}
                >
                  <motion.div
                    key={pathname}
                    {...crossfadeVariants(shouldReduceMotion)}
                    transition={crossfadeTransition(shouldReduceMotion)}
                    className="flex flex-col flex-1 min-w-0"
                  >
                    {/* width is load-bearing: `.page`'s `margin: 0 auto` suppresses flex
                        stretch, so without it the sheet sizes to its content. */}
                    <Page
                      texture={{ texture: 'parchment' }}
                      outline
                      className={`min-h-[calc(100vh-160px)] w-full ${isLarge ? 'max-w-none' : ''}`}
                    >
                      <Suspense fallback={null}>
                        <Outlet />
                      </Suspense>
                    </Page>
                  </motion.div>
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
            {item.label}
          </Button>
        ))}
      </nav>
    </ToastProvider>
  );
};

const rootRoute = createRootRoute({ component: RootLayout });

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlansPage,
  validateSearch: (search: Record<string, unknown>): { subject?: string } => ({
    subject: typeof search.subject === 'string' ? search.subject : undefined,
  }),
});
const planDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans/$planId',
  component: PlansPage,
});
const ideaDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ideas/$ideaId',
  component: PlansPage,
});
const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsPage,
});
const docsSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/$section',
  component: DocsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});
const settingsSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/$section',
  component: SettingsPage,
});

const roadmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/roadmap',
  component: RoadmapPage,
  validateSearch: (search: Record<string, unknown>): { item?: string } => ({
    item: typeof search.item === 'string' ? search.item : undefined,
  }),
});

const diffRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diff',
  component: DiffPage,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  component: StatsPage,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  component: TasksPage,
  validateSearch: (search: Record<string, unknown>): { taskId?: string } => ({
    taskId: typeof search.taskId === 'string' ? search.taskId : undefined,
  }),
});

const routeTree = rootRoute.addChildren([
  plansRoute,
  planDetailRoute,
  ideaDetailRoute,
  docsRoute,
  docsSectionRoute,
  settingsRoute,
  settingsSectionRoute,
  tasksRoute,
  roadmapRoute,
  diffRoute,
  statsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
