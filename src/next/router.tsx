import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { mountPrefix } from '@/app/services/mount';
import { nextBasepath } from './entry-path';
import { NextRoot } from './views/next-root';
import { PlaceholderPage } from './views/placeholder-page';
import { UiGalleryPage } from './views/ui-gallery-page';

const rootRoute = createRootRoute({ component: NextRoot, notFoundComponent: PlaceholderPage });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlaceholderPage,
});

const uiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ui',
  component: UiGalleryPage,
});

const routeTree = rootRoute.addChildren([homeRoute, uiRoute]);

export const router = createRouter({ routeTree, basepath: nextBasepath(mountPrefix) });
