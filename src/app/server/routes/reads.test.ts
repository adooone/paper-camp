import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readRoutes } from './reads';
import type { RouteContext } from './types';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(config?: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-reads-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  if (config !== undefined) {
    await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify(config), 'utf-8');
  }
  return root;
}

function route(root: string, path: string) {
  const found = readRoutes({ root } as RouteContext).find((r) => r.path === path);
  if (!found) throw new Error(`no read route registered for ${path}`);
  return found;
}

function fakeRes(): { res: ServerResponse; status: () => number; json: () => unknown } {
  let statusCode = 0;
  let body = '';
  const res = {
    setHeader: () => {},
    end: (chunk?: string) => {
      body = chunk ?? '';
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
  } as unknown as ServerResponse;
  return { res, status: () => statusCode, json: () => JSON.parse(body) };
}

describe('readRoutes', () => {
  it('registers every entry as a GET route, not the legacy any-method match', async () => {
    const root = await makeRoot();
    for (const r of readRoutes({ root } as RouteContext)) {
      expect(r.method).toBe('GET');
    }
  });

  it('answers 200 with the handler result', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, '/api/package-name').handle({} as IncomingMessage, res);
    expect(status()).toBe(200);
    expect(json()).toBeNull();
  });
});

describe('GET /api/config', () => {
  it('answers null when config.json is missing', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, '/api/config').handle({} as IncomingMessage, res);
    expect(status()).toBe(200);
    expect(json()).toBeNull();
  });

  it('coerces defaultAgents and fills in subjects from the roadmap', async () => {
    const root = await makeRoot({
      projectName: 'demo',
      defaultAgents: { phase: 'opencode' },
    });
    const { res, json } = fakeRes();
    await route(root, '/api/config').handle({} as IncomingMessage, res);
    const body = json() as { projectName: string; defaultAgents: { phase: { agent: string } } };
    expect(body.projectName).toBe('demo');
    expect(body.defaultAgents.phase).toEqual({ agent: 'opencode' });
  });
});
