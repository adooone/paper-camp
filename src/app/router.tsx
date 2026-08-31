import { AppShell } from '@/app/components/layout/app-shell';
import { HubHome } from '@/app/features/hub';
import { PlansPage } from '@/app/features/plans/index';
import { bareId } from '@/app/hooks';
import type { ModuleLayer } from '@/app/services/module-layer';
import { mountPrefix } from '@/app/services/mount';
import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { lazy } from 'react';

export { HUB_PATH } from '@/app/components/layout/nav';

const DocsPage = lazy(() =>
  import('@/app/features/docs/index').then((m) => ({ default: m.DocsPage })),
);
const SettingsPage = lazy(() =>
  import('@/app/features/settings/index').then((m) => ({ default: m.SettingsPage })),
);
const TasksPage = lazy(() =>
  import('@/app/features/tasks/index').then((m) => ({ default: m.TasksPage })),
);
const RoadmapPage = lazy(() =>
  import('@/app/features/roadmap/index').then((m) => ({ default: m.RoadmapPage })),
);
const StatsPage = lazy(() =>
  import('@/app/features/stats/index').then((m) => ({ default: m.StatsPage })),
);
const GitPage = lazy(() =>
  import('@/app/features/git/index').then((m) => ({ default: m.GitPage })),
);
const InboxPage = lazy(() =>
  import('@/app/features/inbox/index').then((m) => ({ default: m.InboxPage })),
);
const IssuesPage = lazy(() =>
  import('@/app/features/issues/index').then((m) => ({ default: m.IssuesPage })),
);

const rootRoute = createRootRoute({ component: AppShell });

// The hub's own page, reachable whether or not a project is open. Registry state
// is device-local, so this needs no runtime and no corpus.
const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: HubHome,
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
