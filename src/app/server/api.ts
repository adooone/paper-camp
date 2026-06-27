import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { applyEnvEntries, parseEnv } from '../../core/env';
import {
  findConsistencyIssues,
  parseDecisions,
  parseIdeas,
  parseOpenQuestions,
  parsePlans,
  parseProgress,
} from '../../core/parser';
import {
  appendBlock,
  assignPlanId,
  formatPlanEntry,
  formatPlans,
  todayDateString,
} from '../../core/serializer';
import {
  AGENT_IDS,
  type AgentId,
  type EnvEntry,
  type LogEntry,
  PLAN_KINDS,
  type PaperCampConfig,
  type PhaseItem,
  type PlanEntry,
  type PlanStatus,
} from '../../types/index';
import { createActivityManager } from './activity';
import { type AgentManager, createAgentManager } from './agent';
import { createGitManager } from './git';
import { createStatusManager } from './status';

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

interface ApiRoute {
  path: string;
  handler: (root: string) => Promise<unknown>;
}

const campFile = (root: string, name: string) => join(root, 'papercamp', name);

const CONFIG_ALLOWLIST = [
  'biome.json',
  'tsconfig.json',
  'tailwind.config.ts',
  'vite.config.ts',
  'vite.app.config.ts',
  'postcss.config.js',
  'package.json',
];

const apiRoutes: ApiRoute[] = [
  {
    path: '/api/package-name',
    handler: async (root) => {
      const raw = await readMaybe(join(root, 'package.json'));
      if (!raw) return null;
      try {
        const pkg = JSON.parse(raw);
        return pkg.name ?? null;
      } catch {
        return null;
      }
    },
  },
  {
    path: '/api/plans',
    handler: async (root) => parsePlans(await readMaybe(campFile(root, 'plans.md'))),
  },
  {
    path: '/api/progress',
    handler: async (root) => ({
      entries: parseProgress(await readMaybe(campFile(root, 'progress.md'))),
    }),
  },
  {
    path: '/api/decisions',
    handler: async (root) => parseDecisions(await readMaybe(campFile(root, 'decisions.md'))),
  },
  {
    path: '/api/open-questions',
    handler: async (root) =>
      parseOpenQuestions(await readMaybe(campFile(root, 'open-questions.md'))),
  },
  {
    path: '/api/ideas',
    handler: async (root) => ({
      content: await readMaybe(campFile(root, 'ideas.md')),
    }),
  },
  {
    path: '/api/consistency',
    handler: async (root) => {
      const [decisionsRaw, openQuestionsRaw, plansRaw] = await Promise.all([
        readMaybe(campFile(root, 'decisions.md')),
        readMaybe(campFile(root, 'open-questions.md')),
        readMaybe(campFile(root, 'plans.md')),
      ]);
      const decisions = parseDecisions(decisionsRaw);
      const openQuestions = parseOpenQuestions(openQuestionsRaw);
      const plans = parsePlans(plansRaw);
      return findConsistencyIssues(decisions.entries, openQuestions.entries, plans.entries);
    },
  },
  {
    path: '/api/config',
    handler: async (root) => {
      const raw = await readMaybe(join(root, '.paper-camp', 'config.json'));
      return raw ? JSON.parse(raw) : null;
    },
  },
  {
    path: '/api/docs',
    handler: async (root) => {
      const docNames = ['MAIN.md', 'README.md', 'CHANGELOG.md', 'LICENSE'];
      const files: { name: string; content: string }[] = [];
      for (const name of docNames) {
        const content = await readMaybe(join(root, name));
        if (content) files.push({ name, content });
      }
      return { files };
    },
  },
  {
    path: '/api/configs',
    handler: async (root) => {
      const configNames = [
        'biome.json',
        'tsconfig.json',
        'tailwind.config.ts',
        'vite.config.ts',
        'vite.app.config.ts',
        'postcss.config.js',
        'package.json',
      ];
      const files: string[] = [];
      for (const name of configNames) {
        const content = await readMaybe(join(root, name));
        if (content) files.push(name);
      }
      return { files };
    },
  },
];

export interface ApiMiddleware {
  (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
  agent: AgentManager;
}

export function createApiMiddleware(root: string): ApiMiddleware {
  const activity = createActivityManager(root);
  const git = createGitManager(root);
  const status = createStatusManager(root);
  const agent = createAgentManager(root);
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = (req.url ?? '').split('?')[0];

    // DELETE /api/plans?title=... — remove a plan entry
    if (req.method === 'DELETE' && pathname === '/api/plans') {
      try {
        const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
        const title = url.searchParams.get('title');
        if (!title?.trim()) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'title is required' }));
          return;
        }
        const filePath = campFile(root, 'plans.md');
        const parsed = parsePlans(await readMaybe(filePath));
        const trimmed = title.trim();
        const remaining = parsed.entries.filter((entry) => entry.title !== trimmed);
        if (remaining.length === parsed.entries.length) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'plan not found' }));
          return;
        }
        await writeFile(filePath, formatPlans(remaining));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // POST /api/plans — append a new idea entry
    if (req.method === 'POST' && pathname === '/api/plans') {
      try {
        const body = await readBody(req);
        const { title, content, kind } = JSON.parse(body) as {
          title: string;
          content?: string;
          kind?: string;
        };
        if (!title?.trim()) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'title is required' }));
          return;
        }
        const planKind =
          kind && PLAN_KINDS.includes(kind as (typeof PLAN_KINDS)[number]) ? kind : 'feat';

        const configPath = join(root, '.paper-camp', 'config.json');
        const id = await assignPlanId(configPath, planKind);

        const entry = formatPlanEntry({
          title: title.trim(),
          status: 'idea',
          kind: planKind,
          id,
          created: todayDateString(),
          body: content?.trim(),
        });
        await appendBlock(campFile(root, 'plans.md'), entry);
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, id }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // PATCH /api/plans?title=... — update an existing plan entry
    if (req.method === 'PATCH' && pathname === '/api/plans') {
      try {
        const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
        const title = url.searchParams.get('title');
        if (!title?.trim()) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'title is required' }));
          return;
        }
        const body = await readBody(req);
        const updates = JSON.parse(body) as {
          phases?: PhaseItem[];
          status?: PlanStatus;
          log?: LogEntry[];
          agent?: AgentId | null;
        };
        if (updates.agent && !AGENT_IDS.includes(updates.agent)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'agent must be a known agent id' }));
          return;
        }
        const filePath = campFile(root, 'plans.md');
        const parsed = parsePlans(await readMaybe(filePath));
        const trimmed = title.trim();
        let found = false;
        const updated = parsed.entries.map((entry: PlanEntry) => {
          if (entry.title === trimmed) {
            found = true;
            return {
              ...entry,
              ...(updates.status !== undefined && { status: updates.status }),
              ...(updates.phases !== undefined && { phases: updates.phases }),
              ...(updates.log !== undefined && { log: updates.log }),
              ...(updates.agent !== undefined && { agent: updates.agent ?? undefined }),
              updated: todayDateString(),
            };
          }
          // Starting a plan puts it in focus — only one plan is "in focus" at a time.
          if (
            updates.status === 'in-progress' &&
            (entry.status === 'in-progress' || entry.status === 'review')
          ) {
            return { ...entry, status: 'planned' as const, updated: todayDateString() };
          }
          return entry;
        });
        if (!found) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'plan not found' }));
          return;
        }
        await writeFile(filePath, formatPlans(updated));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // POST /api/ideas — append a new idea entry to ideas.md
    if (req.method === 'POST' && pathname === '/api/ideas') {
      try {
        const body = await readBody(req);
        const { title, content } = JSON.parse(body) as { title?: string; content?: string };
        if (!title?.trim()) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'title is required' }));
          return;
        }
        const filePath = campFile(root, 'ideas.md');
        const existing = await readMaybe(filePath);
        const parsed = parseIdeas(existing);
        const maxNum = parsed.reduce((max, idea) => {
          if (idea.id) {
            const num = Number.parseInt(idea.id.replace('IDEA-', ''), 10);
            return Number.isNaN(num) ? max : Math.max(max, num);
          }
          return max;
        }, 0);
        const newId = `IDEA-${maxNum + 1}`;
        const section = `### ${newId}: ${title.trim()}\n\n${content?.trim() ?? ''}`;
        const trimmed = existing.trimEnd();
        const separator = trimmed.length === 0 ? '' : '\n\n---\n\n';
        await writeFile(filePath, `${trimmed}${separator}${section}\n`);
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, id: newId }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // GET /api/icon — serve project icon
    if (req.method === 'GET' && pathname === '/api/icon') {
      const assetsDir = join(root, '.paper-camp', 'assets');
      const mimeMap: Record<string, string> = {
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      for (const [ext, mime] of Object.entries(mimeMap)) {
        try {
          const data = await readFile(join(assetsDir, `icon.${ext}`));
          res.statusCode = 200;
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'no-cache');
          res.end(data);
          return;
        } catch {
          /* try next */
        }
      }
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'no icon uploaded' }));
      return;
    }

    // POST /api/icon — upload project icon
    if (req.method === 'POST' && pathname === '/api/icon') {
      try {
        const body = await readBody(req);
        const { dataUri } = JSON.parse(body) as { dataUri?: string };
        if (!dataUri) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'dataUri is required' }));
          return;
        }
        const match = dataUri.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/);
        if (!match) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'invalid data URI' }));
          return;
        }
        const mime = match[1];
        const ext = mime === 'image/svg+xml' ? 'svg' : mime.split('/')[1];
        const buffer = Buffer.from(match[2], 'base64');
        const assetsDir = join(root, '.paper-camp', 'assets');
        await mkdir(assetsDir, { recursive: true });
        await writeFile(join(assetsDir, `icon.${ext}`), buffer);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // GET /api/git/status — return working tree status
    if (req.method === 'GET' && pathname === '/api/git/status') {
      try {
        const entries = await git.getStatus();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(entries));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // POST /api/git/commit — stage files and create a commit
    if (req.method === 'POST' && pathname === '/api/git/commit') {
      try {
        const body = await readBody(req);
        const { files, title, message } = JSON.parse(body) as {
          files: string[];
          title: string;
          message?: string;
        };
        if (!title?.trim()) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'title is required' }));
          return;
        }
        await git.commit(files ?? [], title.trim(), message?.trim());
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // GET /api/status — return current lint/format/test check results
    if (req.method === 'GET' && pathname === '/api/status') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(status.getStatus()));
      return;
    }

    // POST /api/status/check?name=lint|format|test — trigger a one-off check run
    if (req.method === 'POST' && pathname === '/api/status/check') {
      const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
      const name = url.searchParams.get('name');
      if (name !== 'lint' && name !== 'format' && name !== 'test') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'name must be lint, format, or test' }));
        return;
      }
      status.runCheck(name);
      res.statusCode = 202;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // POST /api/status/fix — run `biome check . --write` to auto-fix lint/format issues
    if (req.method === 'POST' && pathname === '/api/status/fix') {
      status.runQualityFix();
      res.statusCode = 202;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // GET /api/activity/stream — SSE endpoint for live activity events
    if (req.method === 'GET' && pathname === '/api/activity/stream') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      activity.subscribe(res);
      git.subscribe(res);
      status.subscribe(res);
      agent.subscribe(res);
      return;
    }

    // GET /api/agent/status — current agent task state, if any
    if (req.method === 'GET' && pathname === '/api/agent/status') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(agent.getStatus()));
      return;
    }

    // POST /api/agent/launch — start a headless agent on one plan phase
    if (req.method === 'POST' && pathname === '/api/agent/launch') {
      try {
        const body = await readBody(req);
        const { planId, phaseIndex } = JSON.parse(body) as { planId?: string; phaseIndex?: number };
        if (!planId || typeof phaseIndex !== 'number') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'planId and phaseIndex are required' }));
          return;
        }
        const parsed = parsePlans(await readMaybe(campFile(root, 'plans.md')));
        const plan = parsed.entries.find((p) => p.id === planId);
        if (!plan) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'plan not found' }));
          return;
        }
        const result = await agent.start(plan, phaseIndex);
        if (!result.ok) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        res.statusCode = 202;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // POST /api/agent/launch-audit — start a headless agent on a plan-scoped convergence audit
    if (req.method === 'POST' && pathname === '/api/agent/launch-audit') {
      try {
        const body = await readBody(req);
        const { planId, prompt } = JSON.parse(body) as { planId?: string; prompt?: string };
        if (!planId || !prompt) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'planId and prompt are required' }));
          return;
        }
        const parsed = parsePlans(await readMaybe(campFile(root, 'plans.md')));
        const plan = parsed.entries.find((p) => p.id === planId);
        if (!plan) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'plan not found' }));
          return;
        }
        const result = agent.startForPlan(plan, prompt);
        if (!result.ok) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        res.statusCode = 202;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // POST /api/agent/launch-draft — start a headless agent that drafts a new plan from an idea
    if (req.method === 'POST' && pathname === '/api/agent/launch-draft') {
      try {
        const body = await readBody(req);
        const { ideaId, prompt } = JSON.parse(body) as { ideaId?: string; prompt?: string };
        if (!ideaId || !prompt) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'ideaId and prompt are required' }));
          return;
        }
        const ideas = parseIdeas(await readMaybe(campFile(root, 'ideas.md')));
        const idea = ideas.find((i) => i.id === ideaId);
        if (!idea) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'idea not found' }));
          return;
        }
        const result = agent.startForIdea(idea, prompt);
        if (!result.ok) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        res.statusCode = 202;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // POST /api/agent/launch-extend — start a headless agent to extend an idea's body
    if (req.method === 'POST' && pathname === '/api/agent/launch-extend') {
      try {
        const body = await readBody(req);
        const { ideaId, prompt } = JSON.parse(body) as { ideaId?: string; prompt?: string };
        if (!ideaId || !prompt) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'ideaId and prompt are required' }));
          return;
        }
        const ideas = parseIdeas(await readMaybe(campFile(root, 'ideas.md')));
        const idea = ideas.find((i) => i.id === ideaId);
        if (!idea) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'idea not found' }));
          return;
        }
        const result = agent.startForIdeaExtend(idea, prompt);
        if (!result.ok) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        res.statusCode = 202;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // POST /api/agent/stop — kill the running agent task
    if (req.method === 'POST' && pathname === '/api/agent/stop') {
      const result = agent.stop();
      if (!result.ok) {
        res.statusCode = 409;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: result.error }));
        return;
      }
      res.statusCode = 202;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // POST /api/config — update editable fields in .paper-camp/config.json (port, projectName)
    if (req.method === 'POST' && pathname === '/api/config') {
      try {
        const configPath = join(root, '.paper-camp', 'config.json');
        const raw = await readMaybe(configPath);
        if (!raw) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'config not found' }));
          return;
        }
        const body = await readBody(req);
        const { port, projectName, defaultAgent } = JSON.parse(body) as {
          port?: number;
          projectName?: string;
          defaultAgent?: AgentId;
        };
        if (port !== undefined && (!Number.isInteger(port) || port <= 0)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'port must be a positive integer' }));
          return;
        }
        if (projectName !== undefined && projectName.trim().length === 0) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'projectName must not be empty' }));
          return;
        }
        if (defaultAgent !== undefined && !AGENT_IDS.includes(defaultAgent)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'defaultAgent must be a known agent id' }));
          return;
        }
        const config = JSON.parse(raw) as PaperCampConfig;
        const updated: PaperCampConfig = {
          ...config,
          ...(port !== undefined && { port }),
          ...(projectName !== undefined && { projectName: projectName.trim() }),
          ...(defaultAgent !== undefined && { defaultAgent }),
        };
        await writeFile(configPath, JSON.stringify(updated, null, 2));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // GET /api/env — read the project root's .env, masked client-side only
    if (req.method === 'GET' && pathname === '/api/env') {
      try {
        const envPath = join(root, '.env');
        const examplePath = join(root, '.env.example');
        const [exists, exampleExists] = await Promise.all([
          fileExists(envPath),
          fileExists(examplePath),
        ]);
        const entries = exists ? parseEnv(await readMaybe(envPath)) : [];
        const exampleKeys = exampleExists
          ? parseEnv(await readMaybe(examplePath)).map((e) => e.key)
          : [];
        const envKeys = new Set(entries.map((e) => e.key));
        const missingKeys = exampleKeys.filter((key) => !envKeys.has(key));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ exists, exampleExists, entries, missingKeys }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // POST /api/env — write the full desired entry set back to .env
    if (req.method === 'POST' && pathname === '/api/env') {
      try {
        const body = await readBody(req);
        const { entries } = JSON.parse(body) as { entries?: EnvEntry[] };
        if (!Array.isArray(entries)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'entries is required' }));
          return;
        }
        const keys = new Set<string>();
        for (const entry of entries) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.key)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `invalid key: ${entry.key}` }));
            return;
          }
          if (keys.has(entry.key)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `duplicate key: ${entry.key}` }));
            return;
          }
          keys.add(entry.key);
        }
        const envPath = join(root, '.env');
        const current = await readMaybe(envPath);
        await writeFile(envPath, applyEnvEntries(current, entries));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return;
    }

    // GET /api/configs?name=... — read a specific config file's content
    if (req.method === 'GET' && pathname === '/api/configs') {
      const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
      const name = url.searchParams.get('name');
      if (name) {
        try {
          if (!CONFIG_ALLOWLIST.includes(name)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'invalid config file name' }));
            return;
          }
          const content = await readMaybe(join(root, name));
          if (!content) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'config file not found' }));
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ name, content }));
          return;
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: (error as Error).message }));
          return;
        }
      }
      // No name param: fall through to the generic route handler for listing
    }

    const route = apiRoutes.find((r) => r.path === pathname);
    if (!route) {
      next();
      return;
    }

    try {
      const data = await route.handler(root);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
  };

  (handler as ApiMiddleware).agent = agent;
  return handler as ApiMiddleware;
}
