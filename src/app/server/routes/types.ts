import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ActivityManager } from '../activity';
import type { AgentManager } from '../agent';
import type { GitManager } from '../git';
import type { StatusManager } from '../status';

/** Everything a route module can need — built once per middleware in api.ts. */
export interface RouteContext {
  root: string;
  activity: ActivityManager;
  agent: AgentManager;
  git: GitManager;
  status: StatusManager;
}

/** Exact method + pathname match. An error thrown from handle becomes a 500 JSON reply. */
export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;
}

/**
 * Read-only data routes matched by pathname alone, whatever the method — tried only
 * after every Route. (Pathname-only matching is legacy behavior the dashboard relies
 * on; new endpoints should be Routes.)
 */
export interface ReadRoute {
  path: string;
  handler: (root: string) => Promise<unknown>;
}
