import { Button, IconButton, Layout, Page, ToastProvider, layoutConfig } from '@dendelion/paper-ui';
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ProjectIdentityHeader, SidebarShell, StackPanel } from './components';
import { DocsPage, DocsSidebar } from './features/docs/index';
import { PlanActionsColumn, PlanFilterColumn, PlansPage } from './features/plans/index';
import { SettingsPage, SettingsSidebar } from './features/settings/index';
import { useAppStore } from './stores/app-store';

const navItems = [
  { id: 'plans', label: 'Plans', path: '/' },
  { id: 'docs', label: 'Docs', path: '/docs' },
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

// At/above this width the Stack panel is pinned open (the layout reserves 480px for
// it — see the min-[1440px]:pr-[480px] wrapper) and the sidebar+page group fills the
// remaining width; below it the panel overlays and can be toggled. Keep in sync with
// that Tailwind class, which must stay a static literal.
const LARGE_SCREEN_QUERY = '(min-width: 1440px)';

// On large screens the sidebar+page group fills the available width, leaving a
// two-grid-cell (64px) margin on each side. The Layout already pads its content by
// one 32px cell, so we add just one more cell here to reach the two-cell total.
const CONTENT_MARGIN = 32;

/** Subscribe to a CSS media query; re-renders when it starts/stops matching. */
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
  const isPlansArea =
    pathname === '/' || pathname.startsWith('/plans/') || pathname.startsWith('/ideas/');
  const isDocsArea = pathname === '/docs' || pathname.startsWith('/docs/');
  const activeId = isPlansArea
    ? 'plans'
    : isDocsArea
      ? 'docs'
      : navItems.find((item) => item.path === pathname)?.id;
  const hasSidebar = isPlansArea || isDocsArea || pathname === '/settings';
  const [stackOpen, setStackOpen] = useState(readStoredStackOpen);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const isLarge = useMediaQuery(LARGE_SCREEN_QUERY);

  useEffect(() => {
    loadPlans();
    loadIdeas();
  }, [loadPlans, loadIdeas]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read in the body — close the mobile sidebar on every route change.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <ToastProvider>
      <div className="h-screen box-border min-[1440px]:pr-[480px]">
        <Layout
          background={{ texture: 'paper', ruledType: 'grid', ruledColor: 'blue' }}
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
          <div className="flex h-full min-h-0 justify-center items-stretch box-border overflow-hidden">
            {/* The sidebar + page form one group. On large screens it fills the
                available width (page grows past 800) with a two-grid-cell margin on
                each side. Below that it shrinks to its content (sidebar + gap + up to
                an 800px page) and `justify-center` above keeps it centered, so the
                filters card sits directly beside the page with only contentGap
                between them — never pinned to the far left with a gap. */}
            <div
              className="flex h-full min-h-0 min-w-0"
              style={{
                gap: layoutConfig.contentGap,
                ...(isLarge
                  ? { width: '100%', paddingLeft: CONTENT_MARGIN, paddingRight: CONTENT_MARGIN }
                  : {}),
              }}
            >
              {hasSidebar && (
                <SidebarShell
                  routeKey={pathname}
                  mobileOpen={mobileSidebarOpen}
                  onMobileClose={() => setMobileSidebarOpen(false)}
                >
                  {isPlansArea && (
                    <>
                      <PlanFilterColumn />
                      <PlanActionsColumn />
                    </>
                  )}
                  {isDocsArea && <DocsSidebar />}
                  {pathname === '/settings' && <SettingsSidebar />}
                </SidebarShell>
              )}
              {/* Page column. Large: grow to fill the group. Small: basis 800 (the
                  Page's own max-width), may shrink but never grows, so there's no
                  empty stretch for the Page to re-center inside and drift away. */}
              <div
                className="flex flex-col min-h-0 min-w-0"
                style={{ flex: isLarge ? '1 1 0%' : '0 1 800px' }}
              >
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <Page
                    texture={{ texture: 'parchment' }}
                    outline
                    style={{ height: 'auto', ...(isLarge ? { maxWidth: 'none' } : {}) }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={pathname}
                        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                      >
                        <Outlet />
                      </motion.div>
                    </AnimatePresence>
                  </Page>
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
          // Keep the persistence side effect out of the setState updater (updaters
          // must be pure — StrictMode double-invokes them).
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

const routeTree = rootRoute.addChildren([
  plansRoute,
  planDetailRoute,
  ideaDetailRoute,
  docsRoute,
  docsSectionRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
