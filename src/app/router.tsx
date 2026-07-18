import { Button, IconButton, Layout, Page, ToastProvider, layoutConfig } from '@dendelion/paper-ui';
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Suspense, lazy, useEffect, useState } from 'react';
import { ProjectIdentityHeader, SidebarShell, StackPanel, StatusBar } from './components';
import { PlanActionsColumn, PlanFilterColumn, PlansPage } from './features/plans/index';
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

const navItems = [
  { id: 'plans', label: 'Ideas', path: '/' },
  { id: 'docs', label: 'Docs', path: '/docs' },
  { id: 'tasks', label: 'Tasks', path: '/tasks' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];

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

const CONTENT_MARGIN = 32;

// Mirrors paper-ui `.content`'s padding, which the strip and scroller bleed back out of.
const LAYOUT_CONTENT_PAD = 32;

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

  useEffect(() => {
    loadPlans();
    loadIdeas();
    loadSuggestions();
  }, [loadPlans, loadIdeas, loadSuggestions]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read in the body.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <ToastProvider position="bottom-left">
      <div className="h-screen box-border min-[1440px]:pr-[480px] flex flex-col">
        <StatusBar />
        <Layout
          style={{ flex: '1 1 0%', minHeight: 0, height: 'auto' }}
          background={{ texture: 'speckle', ruledType: 'grid', ruledColor: 'blue' }}
          showHeader
          headerTexture="parchment"
          showSidebar={false}
          showPage={false}
          bleedBottom
          headerActions={
            <>
              {hasSidebar && (
                <IconButton
                  variant="ghost"
                  size="small"
                  className="lg:hidden"
                  label="Open sidebar"
                  onClick={() => setMobileSidebarOpen(true)}
                  icon={
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
                  }
                />
              )}
              <ProjectIdentityHeader size="sm" />
              <div className="flex-1" />
              <nav aria-label="Main navigation" className="flex items-center gap-1">
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
              className="flex flex-1 min-h-0 justify-center items-start box-border overflow-y-auto"
              style={{
                marginTop: -LAYOUT_CONTENT_PAD,
                marginLeft: -LAYOUT_CONTENT_PAD,
                marginRight: -LAYOUT_CONTENT_PAD,
                paddingTop: LAYOUT_CONTENT_PAD,
                paddingBottom: LAYOUT_CONTENT_PAD,
                paddingLeft: LAYOUT_CONTENT_PAD,
                paddingRight: LAYOUT_CONTENT_PAD,
              }}
            >
              {/* --pc-sidebar-h: the sticky sidebar can't size off this group (it's as
                  tall as the page). lg only — below that it's a full-height drawer. */}
              <div
                className="flex min-w-0 justify-center lg:[--pc-sidebar-h:calc(100vh-160px)]"
                style={{
                  gap: layoutConfig.contentGap,
                  width: '100%',
                  ...(isLarge ? { paddingLeft: CONTENT_MARGIN, paddingRight: CONTENT_MARGIN } : {}),
                }}
              >
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
                  className="flex flex-col min-w-0"
                  style={{ flex: isLarge ? '1 1 0%' : '0 1 800px' }}
                >
                  <motion.div
                    key={pathname}
                    {...crossfadeVariants(shouldReduceMotion)}
                    transition={crossfadeTransition(shouldReduceMotion)}
                    style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
                  >
                    {/* width is load-bearing: `.page`'s `margin: 0 auto` suppresses flex
                        stretch, so without it the sheet sizes to its content. */}
                    <Page
                      texture={{ texture: 'parchment' }}
                      outline
                      style={{
                        minHeight: 'calc(100vh - 160px)',
                        width: '100%',
                        ...(isLarge ? { maxWidth: 'none' } : {}),
                      }}
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
    </ToastProvider>
  );
};

const rootRoute = createRootRoute({ component: RootLayout });

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlansPage,
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
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
