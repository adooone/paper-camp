import { agentRoutes } from './agent';
import { capabilitiesRoutes } from './capabilities';
import { checkRoutes } from './checks';
import { ciRoutes } from './ci';
import { ideaRoutes, planRoutes } from './content';
import { gitRoutes } from './git';
import { notificationRoutes } from './notifications';
import { releaseNotesRoutes } from './release-notes';
import { serviceRoutes } from './services';
import { statusRoutes } from './status';
import { configRoutes, envRoutes, iconRoutes, mergePolicyRoutes } from './system';
import { taskRoutes } from './tasks';
import { trailRoutes } from './trail';
import type { Route, RouteContext } from './types';

export { readRoutes } from './reads';
export type { Route, RouteContext } from './types';

export function buildRoutes(ctx: RouteContext): Route[] {
  return [
    ...planRoutes(ctx),
    ...ideaRoutes(ctx),
    ...iconRoutes(ctx),
    ...gitRoutes(ctx),
    ...capabilitiesRoutes(ctx),
    ...statusRoutes(ctx),
    ...serviceRoutes(ctx),
    ...checkRoutes(ctx),
    ...ciRoutes(ctx),
    ...agentRoutes(ctx),
    ...taskRoutes(ctx),
    ...notificationRoutes(ctx),
    ...configRoutes(ctx),
    ...envRoutes(ctx),
    ...mergePolicyRoutes(ctx),
    ...trailRoutes(ctx),
    ...releaseNotesRoutes(ctx),
  ];
}
