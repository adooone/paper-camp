import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterAll, describe, expect, it } from 'vitest';
import { type GitManager, createGitManager } from '../app/server/git';
import { registerReadTools, registerWriteTools } from './tools';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/** A throwaway git repo (main branch) with a scaffolded, empty papercamp/ project. */
async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-mcp-test-'));
  roots.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  await mkdir(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
  await writeFile(
    join(root, 'papercamp', 'config.json'),
    `${JSON.stringify({ nextId: { idea: 1 } }, null, 2)}\n`,
  );
  await writeFile(join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'initial commit');
  return root;
}

async function writePlan(root: string, id: string, contents: string): Promise<void> {
  await writeFile(join(root, 'papercamp', 'ideas', `${id}.md`), contents);
}

function planFile(opts: {
  id: string;
  title: string;
  status?: string;
  phases?: string[];
}): string {
  const { id, title, status = 'in-progress', phases = ['- [ ] First phase'] } = opts;
  return `---
id: ${id}
title: ${title}
type: feat
status: ${status}
created: 2026-07-01
---
Body of ${id}.

### Phases
${phases.join('\n')}
`;
}

/** Connects a client to a fresh server with both tool sets registered, over an in-memory transport. */
async function connect(root: string, gitManager: GitManager): Promise<Client> {
  const server = new McpServer({ name: 'paper-camp-test', version: '0.0.0' });
  registerReadTools(server, root);
  registerWriteTools(server, root, gitManager);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('read tools', () => {
  it('list_plans returns per-file plans', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'First plan' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({ name: 'list_plans', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      entries: [expect.objectContaining({ id: 'IDEA-1', title: 'First plan' })],
      warnings: [],
    });
  });

  it('get_plan finds a plan by id and returns null for an unknown id', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'First plan' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const found = await client.callTool({ name: 'get_plan', arguments: { id: 'IDEA-1' } });
    expect(found.structuredContent).toMatchObject({
      entry: expect.objectContaining({ id: 'IDEA-1', title: 'First plan' }),
    });

    const missing = await client.callTool({ name: 'get_plan', arguments: { id: 'IDEA-99' } });
    expect(missing.structuredContent).toEqual({ entry: null });
  });

  it('list_open_questions returns parsed entries', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'open-questions.md'),
      '## Should we ship X?\n\n**Status:** open\n**Raised:** 2026-07-01\n\nBody.\n',
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({ name: 'list_open_questions', arguments: {} });
    expect(result.structuredContent).toMatchObject({
      entries: [expect.objectContaining({ title: 'Should we ship X?', status: 'open' })],
      warnings: [],
    });
  });

  it('list_decisions returns parsed entries', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'decisions.md'),
      '## Use MCP\n\n**Date:** 2026-07-01\n**Status:** decided\n\nBody.\n',
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({ name: 'list_decisions', arguments: {} });
    expect(result.structuredContent).toMatchObject({
      entries: [expect.objectContaining({ title: 'Use MCP', status: 'decided' })],
      warnings: [],
    });
  });
});

describe('write tools', () => {
  it('add_idea allocates the next id, writes the file, and regenerates the index', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'ideas', 'IDEA-1.md'),
      '---\nid: IDEA-1\ntitle: Old\nstatus: idea\ncreated: 2026-07-01\n---\n',
    );
    // Ids mint from the unified counter (not max-existing) — seed it past IDEA-1.
    await writeFile(
      join(root, 'papercamp', 'config.json'),
      `${JSON.stringify({ nextId: { idea: 2 } }, null, 2)}\n`,
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'add_idea',
      arguments: { title: 'New idea', content: 'Some body.' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ ok: true, id: 'IDEA-2' });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(written).toContain('title: New idea');
    expect(written).toContain('Some body.');

    const index = await readFile(join(root, 'papercamp', 'ideas', 'index.md'), 'utf-8');
    expect(index).toContain('IDEA-2');
  });

  it('draft_plan assigns the next id for its kind, writes the file, and regenerates the index', async () => {
    const root = await makeRoot();
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'draft_plan',
      arguments: { title: 'Brand new plan', content: 'Plan body.' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ ok: true, id: 'IDEA-1' });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('title: Brand new plan');
    expect(written).toContain('status: idea');

    const index = await readFile(join(root, 'papercamp', 'ideas', 'index.md'), 'utf-8');
    expect(index).toContain('IDEA-1');
  });

  it('update_phase toggles the phase by index and regenerates the index', async () => {
    const root = await makeRoot();
    await writePlan(
      root,
      'IDEA-1',
      planFile({
        id: 'IDEA-1',
        title: 'Two-phase plan',
        phases: ['- [ ] First phase', '- [ ] Second phase'],
      }),
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'update_phase',
      arguments: { id: 'IDEA-1', phaseIndex: 0, done: true },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ ok: true });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('- [x] First phase');
    expect(written).toContain('- [ ] Second phase');
  });

  it('update_phase archives the plan file when the new status is done', async () => {
    const root = await makeRoot();
    await writePlan(
      root,
      'IDEA-1',
      planFile({ id: 'IDEA-1', title: 'Nearly done plan', phases: ['- [ ] Only phase'] }),
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'update_phase',
      arguments: { id: 'IDEA-1', phaseIndex: 0, done: true, status: 'done' },
    });
    expect(result.isError).toBeFalsy();

    await expect(
      readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8'),
    ).rejects.toThrow();
    const archived = await readFile(
      join(root, 'papercamp', 'ideas', 'archive', 'IDEA-1.md'),
      'utf-8',
    );
    expect(archived).toContain('status: done');
  });

  it("append_progress prepends a bullet under today's heading", async () => {
    const root = await makeRoot();
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'append_progress',
      arguments: { item: 'Did a thing.' },
    });
    expect(result.isError).toBeFalsy();

    const progress = await readFile(join(root, 'papercamp', 'progress.md'), 'utf-8');
    expect(progress).toContain('- Did a thing.');
  });

  it('resolve_open_question marks the question resolved and logs a decision', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'open-questions.md'),
      '## Should we ship X?\n\n**Status:** open\n**Raised:** 2026-07-01\n\nBody.\n',
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'resolve_open_question',
      arguments: {
        title: 'Should we ship X?',
        decision: 'Ship X',
        rationale: 'Because reasons.',
      },
    });
    expect(result.isError).toBeFalsy();

    const questions = await readFile(join(root, 'papercamp', 'open-questions.md'), 'utf-8');
    expect(questions).toContain('**Status:** resolved');
    expect(questions).toContain('**Resolved-by:** Ship X');

    const decisions = await readFile(join(root, 'papercamp', 'decisions.md'), 'utf-8');
    expect(decisions).toContain('## Ship X');
    expect(decisions).toContain('Because reasons.');
  });
});

describe('branch-conflict guard', () => {
  it('rejects draft_plan while the current branch has an unfinished plan of its own', async () => {
    const root = await makeRoot();
    await writePlan(
      root,
      'IDEA-1',
      planFile({ id: 'IDEA-1', title: 'In-flight plan', status: 'in-progress' }),
    );
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'add IDEA-1');
    git(root, 'checkout', '-b', 'feat/idea-1-in-flight-plan');
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'draft_plan',
      arguments: { title: 'A different plan' },
    });
    expect(result.isError).toBe(true);

    const plansDir = join(root, 'papercamp', 'ideas');
    const { readdir } = await import('node:fs/promises');
    expect((await readdir(plansDir)).filter((f) => f.endsWith('.md'))).toEqual(['IDEA-1.md']);
  });

  it("allows update_phase to advance the branch's own active plan", async () => {
    const root = await makeRoot();
    await writePlan(
      root,
      'IDEA-1',
      planFile({ id: 'IDEA-1', title: 'In-flight plan', status: 'in-progress' }),
    );
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'add IDEA-1');
    git(root, 'checkout', '-b', 'feat/idea-1-in-flight-plan');
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'update_phase',
      arguments: { id: 'IDEA-1', phaseIndex: 0, done: true },
    });
    expect(result.isError).toBeFalsy();
    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('- [x] First phase');
  });

  it('rejects update_phase on a different plan while the branch has an unfinished plan of its own', async () => {
    const root = await makeRoot();
    await writePlan(
      root,
      'IDEA-1',
      planFile({ id: 'IDEA-1', title: 'In-flight plan', status: 'in-progress' }),
    );
    await writePlan(
      root,
      'IDEA-2',
      planFile({ id: 'IDEA-2', title: 'Other plan', status: 'planned' }),
    );
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'add plans');
    git(root, 'checkout', '-b', 'feat/idea-1-in-flight-plan');
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'update_phase',
      arguments: { id: 'IDEA-2', phaseIndex: 0, done: true },
    });
    expect(result.isError).toBe(true);

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(written).toContain('- [ ] First phase');
  });
});
