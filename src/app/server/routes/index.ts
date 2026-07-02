import { agentRoutes } from './agent';
import { configRoutes } from './config';
import { docsRoutes } from './docs';
import { envRoutes } from './env';
import { gitRoutes } from './git';
import { iconRoutes } from './icon';
import { ideaRoutes } from './ideas';
import { planRoutes } from './plans';
import { statusRoutes } from './status';
import type { Route, RouteContext } from './types';

export { readRoutes } from './reads';
export type { ReadRoute, Route, RouteContext } from './types';

export function buildRoutes(ctx: RouteContext): Route[] {
  return [
    ...planRoutes(ctx),
    ...ideaRoutes(ctx),
    ...iconRoutes(ctx),
    ...gitRoutes(ctx),
    ...statusRoutes(ctx),
    ...agentRoutes(ctx),
    ...configRoutes(ctx),
    ...envRoutes(ctx),
    ...docsRoutes(ctx),
  ];
}
