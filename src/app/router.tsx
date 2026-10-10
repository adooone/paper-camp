import { AppShell } from '@/app/components/layout/app-shell';
import { HubHome } from '@/app/features/hub';
import { type GroupMode, isGroupMode } from '@/app/features/plans/helpers';
import { PlansPage } from '@/app/features/plans/index';
import { bareId } from '@/app/hooks';
import { importWithRecovery } from '@/app/services/lazy-page';
import type { ModuleLayer } from '@/app/services/module-layer';
import { mountPrefix } from '@/app/services/mount';
import type { LogSearchParams } from '@/core/run-filters';
import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { lazy } from 'react';

export { HUB_PATH } from '@/app/components/layout/nav';

const DocsPage = lazy(() =>
  importWithRecovery('DocsPage', () => import('@/app/features/docs/index')).then((m) => ({
    default: m.DocsPage,
  })),
);
const SettingsPage = lazy(() =>
  importWithRecovery('SettingsPage', () => import('@/app/features/settings/index')).then((m) => ({
    default: m.SettingsPage,
  })),
);
const RoadmapPage = lazy(() =>
  importWithRecovery('RoadmapPage', () => import('@/app/features/roadmap/index')).then((m) => ({
    default: m.RoadmapPage,
  })),
);
const StatsPage = lazy(() =>
  importWithRecovery('StatsPage', () => import('@/app/features/stats/index')).then((m) => ({
    default: m.StatsPage,
  })),
);
const GitPage = lazy(() =>
  importWithRecovery('GitPage', () => import('@/app/features/git/index')).then((m) => ({
    default: m.GitPage,
  })),
);
const ActivityPage = lazy(() =>
  importWithRecovery('ActivityPage', () => import('@/app/features/activity/index')).then((m) => ({
    default: m.ActivityPage,
  })),
);
const ActivityEntryPage = lazy(() =>
  importWithRecovery('ActivityEntryPage', () => import('@/app/features/activity/index')).then(
    (m) => ({
      default: m.ActivityEntryPage,
    }),
  ),
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
  validateSearch: (search: Record<string, unknown>): { subject?: string; group?: GroupMode } => ({
    subject: typeof search.subject === 'string' ? search.subject : undefined,
    group: isGroupMode(search.group) ? search.group : undefined,
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
const findingChunkDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/findings/chunk/$chunk',
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

// Bare `/roadmap` has no page of its own any more — it only ever redirects, either
// to the item it names or, with none, to the Ideas page's Horizon grouping.
const roadmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/roadmap',
  validateSearch: (search: Record<string, unknown>): { item?: string } => ({
    item: typeof search.item === 'string' ? search.item : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.item) {
      throw redirect({ to: '/roadmap/$item', params: { item: search.item } });
    }
    throw redirect({ to: '/', search: { group: 'horizon' } });
  },
});
const roadmapItemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/roadmap/$item',
  component: RoadmapPage,
  staticData: { layer: 'corpus' },
});

const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  beforeLoad: () => {
    throw redirect({ to: '/activity' });
  },
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

const stringParam = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  validateSearch: (search: Record<string, unknown>): { taskId?: string } => ({
    taskId: stringParam(search.taskId),
  }),
  beforeLoad: ({ search }) => {
    if (search.taskId) {
      throw redirect({
        to: '/activity/$entryId',
        params: { entryId: `task:${search.taskId}` },
      });
    }
    throw redirect({ to: '/activity' });
  },
});

const issuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/issues',
  beforeLoad: () => {
    throw redirect({ to: '/activity' });
  },
});

const activitySearchSchema = (search: Record<string, unknown>): LogSearchParams => ({
  outcome: stringParam(search.outcome),
  type: stringParam(search.type),
  agent: stringParam(search.agent),
  range: stringParam(search.range),
  q: stringParam(search.q),
  sort: stringParam(search.sort),
  // `?unread=1` arrives as the number 1 through the router's search parser.
  unread: search.unread === '1' || search.unread === 1 || search.unread === true ? '1' : undefined,
  kind: stringParam(search.kind),
});

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: ActivityPage,
  validateSearch: activitySearchSchema,
  staticData: { layer: 'runtime' },
});

const activityEntryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity/$entryId',
  component: ActivityEntryPage,
  staticData: { layer: 'runtime' },
});

// `/log` and `/chat` were the old addresses for the merged Activity page
// (IDEA-290) — kept as redirects so links already shared or bookmarked don't 404.
const logRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/log',
  validateSearch: activitySearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/activity', search });
  },
});

const logEntryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/log/$entryId',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/activity/$entryId', params });
  },
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  beforeLoad: () => {
    throw redirect({ to: '/activity', search: { kind: 'chat' } });
  },
});

const routeTree = rootRoute.addChildren([
  plansRoute,
  projectsRoute,
  legacyPlanDetailRoute,
  ideaDetailRoute,
  ticketDetailRoute,
  findingChunkDetailRoute,
  docsRoute,
  docsSectionRoute,
  settingsRoute,
  settingsSectionRoute,
  tasksRoute,
  issuesRoute,
  activityRoute,
  activityEntryRoute,
  logRoute,
  logEntryRoute,
  chatRoute,
  roadmapRoute,
  roadmapItemRoute,
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
