import { Button, Input, Island, Layout, Page, layoutConfig, space } from '@dendelion/paper-ui';
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
import { PlansPage, PlansSidebar } from './features/plans/index';
import { SettingsPage, SettingsSidebar } from './features/settings/index';
import { useAppStore } from './stores/app-store';

const navItems = [
  { id: 'plans', label: 'Plans', path: '/' },
  { id: 'docs', label: 'Docs', path: '/docs' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];

const RootLayout = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const activeId = navItems.find((item) => item.path === pathname)?.id;
  const docSearchQuery = useAppStore((s) => s.docSearchQuery);
  const setDocSearchQuery = useAppStore((s) => s.setDocSearchQuery);
  const [stackOpen, setStackOpen] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    loadPlans();
    loadIdeas();
  }, [loadPlans, loadIdeas]);

  return (
    <Layout
      background={{ texture: 'paper', ruledType: 'grid', ruledColor: 'blue' }}
      showHeader={false}
      showSidebar={false}
      showPage={false}
      bleedBottom
      stackOpen={stackOpen}
      navigationIsland={
        <nav aria-label="Navigation island">
          <Island>
            <ProjectIdentityHeader size="sm" />
            <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.12)' }} />
            {pathname === '/docs' && (
              <div style={{ width: 180 }}>
                <Input
                  size="small"
                  placeholder="Search docs…"
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                />
              </div>
            )}
            <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.12)' }} />
            <div className="flex items-center gap-1">
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
            </div>
          </Island>
        </nav>
      }
    >
      <div
        className="flex h-full min-h-0 justify-center items-stretch box-border overflow-hidden"
        style={{ paddingRight: stackOpen ? layoutConfig.stackPanelWidth : 0 }}
      >
        <div
          className="flex h-full min-h-0 w-full max-w-layout"
          style={{ gap: layoutConfig.contentGap }}
        >
          <SidebarShell routeKey={pathname}>
            {pathname === '/' && <PlansSidebar />}
            {pathname === '/docs' && <DocsSidebar />}
            {pathname === '/settings' && <SettingsSidebar />}
          </SidebarShell>
          <div className="flex flex-1 flex-col min-h-0 min-w-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Page
                texture={{ texture: 'parchment' }}
                style={{
                  height: 'auto',
                  paddingBottom: `calc(${layoutConfig.navIslandBottom} + ${layoutConfig.navIslandHeight} + ${space[4]})`,
                }}
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
      <StackPanel open={stackOpen} onToggle={() => setStackOpen((o) => !o)} />
    </Layout>
  );
};

const rootRoute = createRootRoute({ component: RootLayout });

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlansPage,
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

const routeTree = rootRoute.addChildren([plansRoute, docsRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
