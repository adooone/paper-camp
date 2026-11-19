import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { mountPrefix } from '@/app/services/mount';
import { nextBasepath } from './entry-path';
import { PlaceholderPage } from './views/placeholder-page';

const rootRoute = createRootRoute({ component: Outlet, notFoundComponent: PlaceholderPage });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlaceholderPage,
});

const routeTree = rootRoute.addChildren([homeRoute]);

export const router = createRouter({ routeTree, basepath: nextBasepath(mountPrefix) });
