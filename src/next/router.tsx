import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { mountPrefix } from '@/app/services/mount';
import { nextBasepath } from './entry-path';
import { Shell } from './shell/shell';
import { ChatPage } from './views/chat-page';
import { DeskSetupPage } from './views/desk-setup-page';
import { DiffPage } from './views/diff-page';
import { DocPage } from './views/doc-page';
import { DocsPage } from './views/docs-page';
import { GitPage } from './views/git-page';
import { IdeasPage } from './views/ideas-page';
import { NextRoot } from './views/next-root';
import { NightPage } from './views/night-page';
import { NotFoundPage } from './views/not-found-page';
import { ProjectsPage } from './views/projects-page';
import { QueuePage } from './views/queue-page';
import { ReleasesPage } from './views/releases-page';
import { RoadmapPage } from './views/roadmap-page';
import { LogPage } from './views/runs-page';
import { SettingsPage } from './views/settings-page';
import { StatsPage } from './views/stats-page';
import { UiGalleryPage } from './views/ui-gallery-page';

const rootRoute = createRootRoute({ component: NextRoot, notFoundComponent: NotFoundPage });

const shellRoute = createRoute({ getParentRoute: () => rootRoute, id: 'shell', component: Shell });

const shellScreen = (path: string, component: () => ReactElement) =>
  createRoute({ getParentRoute: () => shellRoute, path, component });

const uiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ui',
  component: UiGalleryPage,
});

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([
    shellScreen('/', ProjectsPage),
    shellScreen('/ideas', IdeasPage),
    shellScreen('/ideas/$ideaId', IdeasPage),
    shellScreen('/chat', ChatPage),
    shellScreen('/log', LogPage),
    shellScreen('/log/$entryId', LogPage),
    shellScreen('/git', GitPage),
    shellScreen('/roadmap', RoadmapPage),
    shellScreen('/stats', StatsPage),
    shellScreen('/diff', DiffPage),
    shellScreen('/docs', DocsPage),
    shellScreen('/docs/releases', ReleasesPage),
    shellScreen('/docs/$doc', DocPage),
    shellScreen('/settings', SettingsPage),
    shellScreen('/settings/desk', DeskSetupPage),
    shellScreen('/night', NightPage),
    shellScreen('/queue', QueuePage),
  ]),
  uiRoute,
]);

export const router = createRouter({ routeTree, basepath: nextBasepath(mountPrefix) });
