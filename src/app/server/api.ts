import type { IncomingMessage, ServerResponse } from 'node:http';
import { createActivityManager } from './activity';
import { type AgentManager, createAgentManager } from './agent';
import { createAgentHooks } from './agent-hooks';
import { createGitManager } from './git';
import { sendJson } from './http';
import { buildRoutes, readRoutes } from './routes/index';
import { createStatusManager } from './status';

export interface ApiMiddleware {
  (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
  agent: AgentManager;
}

export function createApiMiddleware(root: string): ApiMiddleware {
  const activity = createActivityManager(root);
  const git = createGitManager(root);
  const status = createStatusManager(root);
  const hooks = createAgentHooks(root, git);
  const agent = createAgentManager(
    root,
    hooks.stampAuditDate,
    hooks.commitPhase,
    hooks.setRunReview,
  );

  const routes = buildRoutes({ root, activity, agent, git, status });

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = (req.url ?? '').split('?')[0];

    const route = routes.find((r) => r.method === req.method && r.path === pathname);
    if (route) {
      try {
        await route.handle(req, res);
      } catch (error) {
        sendJson(res, 500, { error: (error as Error).message });
      }
      return;
    }

    const read = readRoutes.find((r) => r.path === pathname);
    if (!read) {
      next();
      return;
    }
    try {
      sendJson(res, 200, await read.handler(root));
    } catch (error) {
      sendJson(res, 500, { error: (error as Error).message });
    }
  };

  (handler as ApiMiddleware).agent = agent;
  return handler as ApiMiddleware;
}
