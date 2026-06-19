import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { parseDecisions, parseOpenQuestions, parsePlans, parseProgress } from '../../core/parser';
import { appendBlock, formatPlanEntry, formatPlans, todayDateString } from '../../core/serializer';
import type { PhaseItem, PlanEntry, PlanStatus } from '../../types/index';

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
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
    path: '/api/config',
    handler: async (root) => {
      const raw = await readMaybe(join(root, '.paper-camp', 'config.json'));
      return raw ? JSON.parse(raw) : null;
    },
  },
  {
    path: '/api/docs',
    handler: async (root) => {
      const docNames = ['README.md', 'CHANGELOG.md', 'LICENSE'];
      const files: { name: string; content: string }[] = [];
      for (const name of docNames) {
        const content = await readMaybe(join(root, name));
        if (content) files.push({ name, content });
      }
      return { files };
    },
  },
];

export function createApiMiddleware(root: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
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
        const { title, content } = JSON.parse(body) as { title: string; content?: string };
        if (!title?.trim()) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'title is required' }));
          return;
        }
        const entry = formatPlanEntry({
          title: title.trim(),
          status: 'idea',
          created: todayDateString(),
          body: content?.trim(),
        });
        await appendBlock(campFile(root, 'plans.md'), entry);
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
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
        const updates = JSON.parse(body) as { phases?: PhaseItem[]; status?: PlanStatus };
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
              updated: todayDateString(),
            };
          }
          // Starting a plan puts it in focus — only one plan is "in focus" at a time.
          if (updates.status === 'in-progress' && entry.status === 'in-progress') {
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
}
