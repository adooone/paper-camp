import { Button, Layout, Page, layoutConfig } from '@dendelion/paper-ui';
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
import { PlansPage, PlansSidebar, ReviewPage, ReviewSidebar } from './features/plans/index';
import { SettingsPage, SettingsSidebar } from './features/settings/index';
import { useAppStore } from './stores/app-store';

const navItems = [
  { id: 'plans', label: 'Plans', path: '/' },
  { id: 'review', label: 'Review', path: '/review' },
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

const RootLayout = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const setActivePlanTitle = useAppStore((s) => s.setActivePlanTitle);
  const setActiveIdeaTitle = useAppStore((s) => s.setActiveIdeaTitle);
  const activeId = navItems.find((item) => item.path === pathname)?.id;
  const [stackOpen, setStackOpen] = useState(readStoredStackOpen);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    loadPlans();
    loadIdeas();
  }, [loadPlans, loadIdeas]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the reset trigger (run on every navigation), not read in the body
  useEffect(() => {
    setActivePlanTitle(null);
    setActiveIdeaTitle(null);
    setMobileSidebarOpen(false);
  }, [pathname, setActivePlanTitle, setActiveIdeaTitle]);

  return (
    <Layout
      background={{ texture: 'paper', ruledType: 'grid', ruledColor: 'blue' }}
      showHeader
      showSidebar={false}
      showPage={false}
      bleedBottom
      headerActions={
        <>
          <button
            type="button"
            className="lg:hidden flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
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
          </button>
          <ProjectIdentityHeader size="sm" />
          <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.12)' }} />
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
      <div
        // Stack panel pushes content only when there's room to spare (>=1440px);
        // below that it overlays, since layoutConfig.stackPanelWidth (480) is
        // hardcoded here — Tailwind's arbitrary-value classes must be static.
        className={`flex h-full min-h-0 justify-center items-stretch box-border overflow-hidden ${
          stackOpen ? 'min-[1440px]:pr-[480px]' : ''
        }`}
      >
        <div className="flex h-full min-h-0 w-full" style={{ gap: layoutConfig.contentGap }}>
          <SidebarShell
            routeKey={pathname}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          >
            {pathname === '/' && <PlansSidebar />}
            {pathname === '/review' && <ReviewSidebar />}
            {pathname === '/docs' && <DocsSidebar />}
            {pathname === '/settings' && <SettingsSidebar />}
          </SidebarShell>
          <div className="flex flex-1 flex-col min-h-0 min-w-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Page texture={{ texture: 'parchment' }} style={{ height: 'auto' }}>
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
      <StackPanel
        open={stackOpen}
        onToggle={() =>
          setStackOpen((o) => {
            const next = !o;
            writeStoredStackOpen(next);
            return next;
          })
        }
      />
    </Layout>
  );
};

const rootRoute = createRootRoute({ component: RootLayout });

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlansPage,
});
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  component: ReviewPage,
});
const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([plansRoute, reviewRoute, docsRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
