import { agentRoutes } from './agent';
import { docsRoutes, ideaRoutes, planRoutes } from './content';
import { gitRoutes } from './git';
import { statusRoutes } from './status';
import { configRoutes, envRoutes, iconRoutes } from './system';
import { taskRoutes } from './tasks';
import type { Route, RouteContext } from './types';

export { readRoutes } from './reads';
export type { Route, RouteContext } from './types';

export function buildRoutes(ctx: RouteContext): Route[] {
  return [
    ...planRoutes(ctx),
    ...ideaRoutes(ctx),
    ...iconRoutes(ctx),
    ...gitRoutes(ctx),
    ...statusRoutes(ctx),
    ...agentRoutes(ctx),
    ...taskRoutes(ctx),
    ...configRoutes(ctx),
    ...envRoutes(ctx),
    ...docsRoutes(ctx),
  ];
}
