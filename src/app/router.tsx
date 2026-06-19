import { Button, FolderIcon, Icon, Input, Island, Layout, Page } from '@dendelion/paper-ui';
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DocsPage, DocsSidebar } from './features/docs/index';
import { FocusPage } from './features/focus/index';
import { PlansPage, PlansSidebar } from './features/plans/index';
import { SettingsPage } from './features/settings/index';
import { fetchIconDataUri } from './services/icon-api';
import { fetchPackageName } from './services/package-api';
import { useAppStore } from './stores/app-store';

const kebabToTitle = (s: string) =>
  s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const navItems = [
  { id: 'plans', label: 'Plans', path: '/' },
  { id: 'focus', label: 'Focus', path: '/focus' },
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
  const [projectName, setProjectName] = useState<string | null>(null);
  const [iconDataUri, setIconDataUri] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    loadIdeas();
    fetchPackageName().then((name) => {
      if (name) setProjectName(kebabToTitle(name));
    });
    fetchIconDataUri().then(setIconDataUri);
  }, [loadPlans, loadIdeas]);

  return (
    <Layout
      background={{ texture: 'paper', ruledType: 'grid', ruledColor: 'blue' }}
      showHeader={false}
      showSidebar={false}
      showPage={false}
      navigationIsland={
        <nav aria-label="Navigation island">
          <Island>
            <div className="flex items-center gap-4">
              {iconDataUri ? (
                <img
                  src={iconDataUri}
                  alt=""
                  style={{ width: 20, height: 20, objectFit: 'contain' }}
                />
              ) : (
                <Icon icon={<FolderIcon />} size="small" />
              )}
              <span
                style={{
                  fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                {projectName ?? 'Paper Camp'}
              </span>
            </div>
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
      <div className="flex h-full min-h-0 justify-center items-stretch box-border overflow-hidden">
        <div className="flex h-full min-h-0 w-full max-w-layout gap-6">
          {pathname === '/' && <PlansSidebar />}
          {pathname === '/docs' && <DocsSidebar />}
          <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
            <div className="flex-1 min-h-0 pb-24">
              <Page texture={{ texture: 'parchment' }}>
                <Outlet />
              </Page>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const rootRoute = createRootRoute({ component: RootLayout });

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlansPage,
});
const focusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/focus',
  component: FocusPage,
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

const routeTree = rootRoute.addChildren([plansRoute, focusRoute, docsRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
