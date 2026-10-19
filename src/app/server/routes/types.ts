import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ActivityManager } from '../activity';
import type { AgentManager } from '../agent';
import type { DeskCheckManager } from '../desk-checks';
import type { DeskServiceManager } from '../desk-services';
import type { GitManager } from '../git';
import type { PairCodeManager } from '../pair-code';
import type { PairingManager } from '../pairing';

/** Everything a route module can need — built once per middleware in api.ts. */
export interface RouteContext {
  root: string;
  activity: ActivityManager;
  agent: AgentManager;
  git: GitManager;
  services: DeskServiceManager;
  checks: DeskCheckManager;
  pairing: PairingManager;
  /** Undefined outside the daemon (e.g. `dev-server.ts`'s single-project mode),
   *  which has no pairing-code flow — `/api/pair` there stays token-only. */
  pairCode?: PairCodeManager;
}

/** Exact method + pathname match. An error thrown from handle becomes a 500 JSON reply. */
export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;
}

// Matched by pathname alone, whatever the method, after every Route — legacy
// behavior the dashboard relies on; new endpoints should be Routes.
export interface ReadRoute {
  path: string;
  handler: (root: string) => Promise<unknown>;
}
