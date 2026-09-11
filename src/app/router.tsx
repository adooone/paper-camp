import { AppShell } from '@/app/components/layout/app-shell';
import { HubHome } from '@/app/features/hub';
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
const LogPage = lazy(() =>
  importWithRecovery('LogPage', () => import('@/app/features/runs/index')).then((m) => ({
    default: m.LogPage,
  })),
);
const ChatPage = lazy(() =>
  importWithRecovery('ChatPage', () => import('@/app/features/chat/index')).then((m) => ({
    default: m.ChatPage,
  })),
);
const LogEntryPage = lazy(() =>
  importWithRecovery('LogEntryPage', () => import('@/app/features/runs/index')).then((m) => ({
    default: m.LogEntryPage,
  })),
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
  beforeLoad: () => {
    throw redirect({ to: '/log' });
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
        to: '/log/$entryId',
        params: { entryId: `task:${search.taskId}` },
      });
    }
    throw redirect({ to: '/log' });
  },
});

const issuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/issues',
  beforeLoad: () => {
    throw redirect({ to: '/log' });
  },
});

const logRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/log',
  component: LogPage,
  validateSearch: (search: Record<string, unknown>): LogSearchParams => ({
    outcome: stringParam(search.outcome),
    type: stringParam(search.type),
    agent: stringParam(search.agent),
    range: stringParam(search.range),
    q: stringParam(search.q),
    sort: stringParam(search.sort),
    // `?unread=1` arrives as the number 1 through the router's search parser.
    unread:
      search.unread === '1' || search.unread === 1 || search.unread === true ? '1' : undefined,
  }),
  staticData: { layer: 'runtime' },
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatPage,
  staticData: { layer: 'runtime' },
});

const logEntryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/log/$entryId',
  component: LogEntryPage,
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
  logRoute,
  logEntryRoute,
  chatRoute,
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
