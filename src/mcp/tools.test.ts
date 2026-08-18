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
});

describe('write tools', () => {
  it('add_idea allocates the next id and writes the file', async () => {
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
  });

  it('draft_plan assigns the next id for its kind and writes the file', async () => {
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
  });

  it('update_phase toggles the phase by index', async () => {
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

  it('update_phase does not archive the plan file when the new status is done', async () => {
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

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('status: done');
  });

  it('update_phase archives the plan file when the new status is dropped', async () => {
    const root = await makeRoot();
    await writePlan(
      root,
      'IDEA-1',
      planFile({ id: 'IDEA-1', title: 'Nearly done plan', phases: ['- [ ] Only phase'] }),
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'update_phase',
      arguments: { id: 'IDEA-1', phaseIndex: 0, done: true, status: 'dropped' },
    });
    expect(result.isError).toBeFalsy();

    await expect(
      readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8'),
    ).rejects.toThrow();
    const archived = await readFile(
      join(root, 'papercamp', 'ideas', 'archive', 'IDEA-1.md'),
      'utf-8',
    );
    expect(archived).toContain('status: dropped');
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

describe('edit_idea', () => {
  it('edits title, body, tags, and type', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'Old title' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'edit_idea',
      arguments: {
        id: 'IDEA-1',
        title: 'New title',
        content: 'Rewritten body.',
        tags: ['format', 'mcp'],
        type: 'refactor',
      },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ ok: true });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('title: New title');
    expect(written).toContain('type: refactor');
    expect(written).toContain('- format');
    expect(written).toContain('Rewritten body.');
    expect(written).not.toContain('Body of IDEA-1.');
  });

  it('leaves omitted fields untouched', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'Keep me' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    await client.callTool({ name: 'edit_idea', arguments: { id: 'IDEA-1', tags: ['solo'] } });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('title: Keep me');
    expect(written).toContain('Body of IDEA-1.');
    expect(written).toContain('- solo');
  });

  it('rejects an empty title and an unknown id', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'Title' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const empty = await client.callTool({
      name: 'edit_idea',
      arguments: { id: 'IDEA-1', title: '   ' },
    });
    expect(empty.isError).toBe(true);

    const missing = await client.callTool({
      name: 'edit_idea',
      arguments: { id: 'IDEA-99', title: 'x' },
    });
    expect(missing.isError).toBe(true);
  });
});

describe('append tools', () => {
  it('append_log adds an agent-authored log line to the thread', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'Plan' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'append_log',
      arguments: { id: 'IDEA-1', text: 'Did the thing' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ ok: true });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('### Thread');
    expect(written).toContain('[log] [agent] Did the thing');
  });

  it('append_decision and append_note write open (unchecked) thread entries', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'Plan' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    await client.callTool({
      name: 'append_decision',
      arguments: { id: 'IDEA-1', text: 'Chose files as storage' },
    });
    await client.callTool({
      name: 'append_note',
      arguments: { id: 'IDEA-1', text: 'Worth revisiting' },
    });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('- [ ] ');
    expect(written).toMatch(/- \[ \] .*\[decision\] \[agent\] Chose files as storage/);
    expect(written).toMatch(/- \[ \] .*\[note\] \[agent\] Worth revisiting/);
  });

  it('append_clarification writes a clarification entry', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'Plan' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    await client.callTool({
      name: 'append_clarification',
      arguments: { id: 'IDEA-1', text: 'Meant the write path' },
    });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('[clarification] [agent] Meant the write path');
  });

  it('rejects empty text and an unknown id', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'Plan' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const empty = await client.callTool({
      name: 'append_log',
      arguments: { id: 'IDEA-1', text: '  ' },
    });
    expect(empty.isError).toBe(true);

    const missing = await client.callTool({
      name: 'append_log',
      arguments: { id: 'IDEA-99', text: 'x' },
    });
    expect(missing.isError).toBe(true);
  });
});

describe('promote_suggestion', () => {
  it('mints an idea from a suggestion line and removes that line', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'suggestions.md'),
      '# Suggestions\n\n- 2026-07-01: Guarded gateway — route writes through MCP\n',
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_suggestion',
      arguments: { title: 'Guarded gateway' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ ok: true, id: 'IDEA-1' });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('title: Guarded gateway');
    expect(written).toContain('route writes through MCP');

    const suggestions = await readFile(join(root, 'papercamp', 'suggestions.md'), 'utf-8');
    expect(suggestions).not.toContain('Guarded gateway');
  });

  it('rejects a title that matches no suggestion', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'suggestions.md'),
      '- 2026-07-01: Real one — a description\n',
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_suggestion',
      arguments: { title: 'Nonexistent' },
    });
    expect(result.isError).toBe(true);
  });
});

describe('promote_roadmap_item', () => {
  const roadmap = `# Roadmap

## Horizon 1 — Ready for daily use

- **Packaging** — one command in any repo.
  - A candidate idea
`;

  it('mints an idea from an item and links it back', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'ROADMAP.md'), roadmap);
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_roadmap_item',
      arguments: { horizonTitle: 'Horizon 1 — Ready for daily use', itemName: 'Packaging' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ ok: true, id: 'IDEA-1' });

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('title: Packaging');
    expect(written).toContain('From the roadmap: Horizon 1 — Ready for daily use.');

    const updated = await readFile(join(root, 'ROADMAP.md'), 'utf-8');
    expect(updated).toContain('→ IDEA-1');
    expect(updated).toContain('- **Packaging**');
  });

  it('promotes a candidate, consuming its bullet and linking the item', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'ROADMAP.md'), roadmap);
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_roadmap_item',
      arguments: {
        horizonTitle: 'Horizon 1 — Ready for daily use',
        itemName: 'Packaging',
        candidateName: 'A candidate idea',
      },
    });
    expect(result.isError).toBeFalsy();

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('title: A candidate idea');

    const updated = await readFile(join(root, 'ROADMAP.md'), 'utf-8');
    expect(updated).not.toContain('A candidate idea');
    expect(updated).toContain('→ IDEA-1');
  });

  it('rejects an unknown horizon, item, or candidate', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'ROADMAP.md'), roadmap);
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_roadmap_item',
      arguments: { horizonTitle: 'Horizon 1 — Ready for daily use', itemName: 'Nope' },
    });
    expect(result.isError).toBe(true);
  });
});

describe('promote_thread_message', () => {
  function planWithThread(id: string): string {
    return `---
id: ${id}
title: Threaded plan
type: feat
status: in-progress
created: 2026-07-01
---
Body of ${id}.

### Thread
- [x] 2026-07-01 [chat] [agent] We should split the phases
`;
  }

  it('distills a thread message into an open decision in place', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planWithThread('IDEA-1'));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_thread_message',
      arguments: { id: 'IDEA-1', index: 0, target: 'decision' },
    });
    expect(result.isError).toBeFalsy();

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toMatch(/- \[ \] .*\[decision\] \[agent\] We should split the phases/);
    expect(written).not.toContain('[chat]');
  });

  it('distills into a log and can append a breadcrumb note', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planWithThread('IDEA-1'));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_thread_message',
      arguments: { id: 'IDEA-1', index: 0, target: 'log', note: 'Captured as IDEA-7' },
    });
    expect(result.isError).toBeFalsy();

    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('[log] [agent]');
    expect(written).toContain('Captured as IDEA-7');
  });

  it('rejects an out-of-range index', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planWithThread('IDEA-1'));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_thread_message',
      arguments: { id: 'IDEA-1', index: 5, target: 'log' },
    });
    expect(result.isError).toBe(true);
  });
});

describe('archive_entity', () => {
  it('sets status dropped and moves the file into the archive', async () => {
    const root = await makeRoot();
    await writePlan(root, 'IDEA-1', planFile({ id: 'IDEA-1', title: 'On its way out' }));
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({ name: 'archive_entity', arguments: { id: 'IDEA-1' } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ ok: true });

    await expect(
      readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8'),
    ).rejects.toThrow();
    const archived = await readFile(
      join(root, 'papercamp', 'ideas', 'archive', 'IDEA-1.md'),
      'utf-8',
    );
    expect(archived).toContain('status: dropped');
  });

  it('rejects an unknown id', async () => {
    const root = await makeRoot();
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({ name: 'archive_entity', arguments: { id: 'IDEA-9' } });
    expect(result.isError).toBe(true);
  });
});

describe('branch-conflict guard on the full write surface', () => {
  async function onBranchWithUnfinishedPlan(): Promise<string> {
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
    return root;
  }

  it('rejects add_idea while the branch has an unfinished plan of its own', async () => {
    const root = await onBranchWithUnfinishedPlan();
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({ name: 'add_idea', arguments: { title: 'Sneaky idea' } });
    expect(result.isError).toBe(true);
  });

  it('rejects promote_suggestion while the branch has an unfinished plan of its own', async () => {
    const root = await onBranchWithUnfinishedPlan();
    await writeFile(
      join(root, 'papercamp', 'suggestions.md'),
      '- 2026-07-01: A suggestion — description\n',
    );
    const client = await connect(root, createGitManager(root, { watch: false }));

    const result = await client.callTool({
      name: 'promote_suggestion',
      arguments: { title: 'A suggestion' },
    });
    expect(result.isError).toBe(true);
  });

  it('rejects a mutation on a different plan but allows it on the branch owner', async () => {
    const root = await onBranchWithUnfinishedPlan();
    const client = await connect(root, createGitManager(root, { watch: false }));

    const other = await client.callTool({
      name: 'append_log',
      arguments: { id: 'IDEA-2', text: 'poke' },
    });
    expect(other.isError).toBe(true);

    const own = await client.callTool({
      name: 'append_log',
      arguments: { id: 'IDEA-1', text: 'progress' },
    });
    expect(own.isError).toBeFalsy();
    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(written).toContain('[log] [agent] progress');
  });
});
