import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { mountPrefix } from '@/app/services/mount';
import { nextBasepath } from './entry-path';
import { Shell } from './shell/shell';
import { ComingPage } from './views/coming-page';
import { NextRoot } from './views/next-root';
import { NotFoundPage } from './views/not-found-page';
import { ProjectsPage } from './views/projects-page';
import { SettingsPage } from './views/settings-page';
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
    shellScreen('/ideas', ComingPage),
    shellScreen('/chat', ComingPage),
    shellScreen('/log', ComingPage),
    shellScreen('/git', ComingPage),
    shellScreen('/settings', SettingsPage),
  ]),
  uiRoute,
]);

export const router = createRouter({ routeTree, basepath: nextBasepath(mountPrefix) });
