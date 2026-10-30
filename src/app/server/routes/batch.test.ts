import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatEntityFile } from '@/core/serialize';
import type { PhaseItem, ThreadMessage } from '@/types/index';
import { afterAll, describe, expect, it } from 'vitest';
import { batchRoutes } from './batch';
import type { RouteContext } from './types';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function writeIdea(
  root: string,
  opts: {
    id: string;
    title: string;
    status?: string;
    needs?: string[];
    phases?: PhaseItem[];
    fixes?: PhaseItem[];
    thread?: ThreadMessage[];
  },
): Promise<void> {
  const content = formatEntityFile({
    id: opts.id,
    title: opts.title,
    status: opts.status ?? 'planned',
    created: '2026-01-01',
    needs: opts.needs,
    phases: opts.phases,
    fixes: opts.fixes,
    thread: opts.thread,
  });
  await writeFile(join(root, 'papercamp', 'ideas', `${opts.id}.md`), `${content}\n`, 'utf-8');
}

async function makeProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-batch-route-'));
  dirs.push(dir);
  await mkdir(join(dir, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(dir, 'papercamp', 'config.json'), '{}', 'utf-8');
  return dir;
}

const cleanSnapshot = { branch: 'main', ahead: 0, behind: 0, hasUpstream: true, entries: [] };
const fineHygiene = { status: 'fine' as const, ahead: 0, behind: 0 };

function fakeGit(overrides: Partial<RouteContext['git']> = {}): RouteContext['git'] {
  return {
    getStatusSnapshot: async () => cleanSnapshot,
    getBranchHygieneStatus: async () => fineHygiene,
    findStaleBaseRef: async () => null,
    ...overrides,
  } as RouteContext['git'];
}

function route(ctx: Partial<RouteContext>) {
  const found = batchRoutes(ctx as RouteContext).find(
    (r) => r.method === 'GET' && r.path === '/api/batch/preview',
  );
  if (!found) throw new Error('no GET /api/batch/preview route registered');
  return found;
}

function fakeReq(): IncomingMessage {
  return {} as unknown as IncomingMessage;
}

function fakeRes(): { res: ServerResponse; status: () => number; json: () => unknown } {
  let statusCode = 0;
  let body = '';
  const res = {
    setHeader: () => {},
    end: (chunk: string) => {
      body = chunk;
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

describe('GET /api/batch/preview', () => {
  it('marks a plan with every unchecked phase and no blockers ready', async () => {
    const root = await makeProject();
    await writeIdea(root, {
      id: 'IDEA-1',
      title: 'Ready idea',
      phases: [{ done: false, text: 'Do it' }],
    });
    const { res, status, json } = fakeRes();
    await route({ root, git: fakeGit() }).handle(fakeReq(), res);
    expect(status()).toBe(200);
    const body = json() as { order: { id: string; readiness: { ready: boolean } }[] };
    expect(body.order).toEqual([
      {
        id: 'IDEA-1',
        readiness: { ready: true },
        phaseCount: 1,
        costEstimateUsd: null,
        title: 'Ready idea',
      },
    ]);
  });

  it('lists a backlog idea with no phases outside the queue', async () => {
    const root = await makeProject();
    await writeIdea(root, { id: 'IDEA-1', title: 'Just an idea', status: 'idea' });
    const { res, json } = fakeRes();
    await route({ root, git: fakeGit() }).handle(fakeReq(), res);
    const body = json() as { order: unknown[]; readyCount: number; backlog: unknown[] };
    expect(body.order).toEqual([]);
    expect(body.readyCount).toBe(0);
    expect(body.backlog).toEqual([{ id: 'IDEA-1', title: 'Just an idea', hasPhases: false }]);
  });

  it('reports a blocking need', async () => {
    const root = await makeProject();
    await writeIdea(root, { id: 'IDEA-1', title: 'Needed', phases: [{ done: false, text: 'x' }] });
    await writeIdea(root, {
      id: 'IDEA-2',
      title: 'Blocked',
      needs: ['IDEA-1'],
      phases: [{ done: false, text: 'y' }],
    });
    const { res, json } = fakeRes();
    await route({ root, git: fakeGit() }).handle(fakeReq(), res);
    const body = json() as {
      order: { id: string; readiness: { ready: boolean; reason?: string } }[];
    };
    const blocked = body.order.find((item) => item.id === 'IDEA-2');
    expect(blocked?.readiness).toEqual({
      ready: false,
      reason: 'needs',
      message: 'waits for IDEA-1',
    });
  });

  it('reports only-manual phases left', async () => {
    const root = await makeProject();
    await writeIdea(root, {
      id: 'IDEA-1',
      title: 'Manual only',
      phases: [{ done: false, text: 'x', source: 'manual' }],
    });
    const { res, json } = fakeRes();
    await route({ root, git: fakeGit() }).handle(fakeReq(), res);
    const body = json() as { order: { readiness: { reason?: string } }[] };
    expect(body.order[0].readiness).toEqual({
      ready: false,
      reason: 'manual-only',
      message: 'only manual steps left',
    });
  });

  it('reports an open question', async () => {
    const root = await makeProject();
    await writeIdea(root, {
      id: 'IDEA-1',
      title: 'Parked',
      phases: [{ done: false, text: 'x' }],
      thread: [{ kind: 'question', text: 'Which?', state: 'open' }],
    });
    const { res, json } = fakeRes();
    await route({ root, git: fakeGit() }).handle(fakeReq(), res);
    const body = json() as { order: { readiness: { reason?: string } }[] };
    expect(body.order[0].readiness).toEqual({
      ready: false,
      reason: 'open-question',
      message: 'waiting on your answer',
    });
  });

  it('reports a stale base from the git client', async () => {
    const root = await makeProject();
    await writeIdea(root, { id: 'IDEA-1', title: 'Stale', phases: [{ done: false, text: 'x' }] });
    const { res, json } = fakeRes();
    await route({
      root,
      git: fakeGit({
        findStaleBaseRef: async () => ({ ref: 'main', done: 2, total: 3 }),
      }),
    }).handle(fakeReq(), res);
    const body = json() as { order: { readiness: { reason?: string; message?: string } }[] };
    expect(body.order[0].readiness.reason).toBe('stale-base');
    expect(body.order[0].readiness.message).toMatch(
      /IDEA-1 already has 2\/3 phases complete on main/,
    );
  });

  it('reports the git preflight level', async () => {
    const root = await makeProject();
    const { res, json } = fakeRes();
    await route({
      root,
      git: fakeGit({
        getStatusSnapshot: async () => ({
          ...cleanSnapshot,
          entries: [{ path: 'a.ts', status: 'M', staged: false }],
        }),
      }),
    }).handle(fakeReq(), res);
    const body = json() as { git: { level: string; dirty: boolean } };
    expect(body.git).toEqual({ level: 'dirty', behind: 0, diverged: false, dirty: true });
  });
});
