import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { parseEntityFile } from '@/core/parse';
import { createAgentHooks } from './agent-hooks';
import { createGitManager } from './git';

const run = promisify(execFile);
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const PLAN_MD = `---
id: IDEA-1
title: Test plan
type: feat
status: in-progress
created: 2026-07-01
---
Plan body.

### Phases
- [x] First phase

### Fixes
- [x] First fix
`;

async function makeGitRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-agent-hooks-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), PLAN_MD);
  await run('git', ['init', '-q'], { cwd: root });
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await run('git', ['config', 'user.name', 'Test'], { cwd: root });
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['commit', '-q', '-m', 'init'], { cwd: root });
  return root;
}

describe('commitPhase', () => {
  it('commits a renamed file without failing git add on the old path', async () => {
    const root = await makeGitRoot();
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'old-name.ts'), 'export const x = 1;\n');
    await run('git', ['add', '-A'], { cwd: root });
    await run('git', ['commit', '-q', '-m', 'add file'], { cwd: root });

    const git = createGitManager(root);
    const hooks = createAgentHooks(root, git);
    const startSnapshot = await hooks.snapshotWorkingTree();

    await run('git', ['mv', 'src/old-name.ts', 'src/new-name.ts'], { cwd: root });
    await run('git', ['add', '-A'], { cwd: root });

    const plan = { id: 'IDEA-1', title: 'Test plan', kind: 'feat', tags: [] } as never;
    const phase = { text: 'Rename the file', done: true } as never;

    await expect(hooks.commitPhase(plan, phase, 0, startSnapshot)).resolves.not.toThrow();

    const { stdout } = await run('git', ['status', '--porcelain'], { cwd: root });
    expect(stdout.trim()).not.toContain('old-name.ts');
    const { stdout: headFiles } = await run('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {
      cwd: root,
    });
    expect(headFiles).toContain('src/new-name.ts');
    expect(headFiles).not.toContain('src/old-name.ts');
  }, 65_000);
});

describe('commitVerifyFix', () => {
  it('commits files changed since the run start as a style commit when no fix attempt ran', async () => {
    const root = await makeGitRoot();
    const git = createGitManager(root);
    const hooks = createAgentHooks(root, git);
    const startSnapshot = await hooks.snapshotWorkingTree();

    await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), `${PLAN_MD}\nReformatted.\n`);

    const plan = { id: 'IDEA-1', title: 'Test plan', kind: 'feat', tags: [] } as never;
    await hooks.commitVerifyFix(plan, [], startSnapshot);

    const { stdout } = await run('git', ['log', '-1', '--pretty=%s'], { cwd: root });
    expect(stdout.trim()).toBe('style(plans): format');

    const { stdout: status } = await run('git', ['status', '--porcelain'], { cwd: root });
    expect(status.trim()).toBe('');
  });

  it('commits as a fix commit naming the checks that were red', async () => {
    const root = await makeGitRoot();
    const git = createGitManager(root);
    const hooks = createAgentHooks(root, git);
    const startSnapshot = await hooks.snapshotWorkingTree();

    await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), `${PLAN_MD}\nFixed.\n`);

    const plan = { id: 'IDEA-1', title: 'Test plan', kind: 'feat', tags: [] } as never;
    await hooks.commitVerifyFix(plan, ['lint', 'test'], startSnapshot);

    const { stdout } = await run('git', ['log', '-1', '--pretty=%s'], { cwd: root });
    expect(stdout.trim()).toBe('fix(plans): lint, test');
  });

  it('commits nothing when nothing changed since the run start', async () => {
    const root = await makeGitRoot();
    const git = createGitManager(root);
    const hooks = createAgentHooks(root, git);
    const startSnapshot = await hooks.snapshotWorkingTree();

    const plan = { id: 'IDEA-1', title: 'Test plan', kind: 'feat', tags: [] } as never;
    await hooks.commitVerifyFix(plan, [], startSnapshot);

    const { stdout } = await run('git', ['log', '-1', '--pretty=%s'], { cwd: root });
    expect(stdout.trim()).toBe('init');
  });
});

describe('setRunReview', () => {
  it('commits the review stamp as docs(ideas), not the idea type, so it adds no changelog line', async () => {
    const root = await makeGitRoot();
    const git = createGitManager(root);
    const hooks = createAgentHooks(root, git);

    const plan = { id: 'IDEA-1', title: 'Test plan', kind: 'feat', tags: [] } as never;
    await hooks.setRunReview(plan);

    const { stdout } = await run('git', ['log', '-1', '--pretty=%s'], { cwd: root });
    expect(stdout.trim()).toBe('docs(ideas): mark IDEA-1 review');
  });
});

describe('annotateFixRun', () => {
  it('persists the run stamp to the corpus without committing it', async () => {
    const root = await makeGitRoot();
    const git = createGitManager(root);
    const hooks = createAgentHooks(root, git);

    await hooks.annotateFixRun('IDEA-1', 0, {
      kind: 'fix',
      usage: {
        durationMs: 1500,
        numTurns: 3,
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.01,
      },
    });

    const raw = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    const entry = parseEntityFile(raw).entries[0];
    expect(entry.fixes?.[0].run).toEqual(
      expect.objectContaining({ durationMs: 2000, inputTokens: 100, outputTokens: 50 }),
    );

    const { stdout } = await run('git', ['status', '--porcelain'], { cwd: root });
    expect(stdout.trim()).not.toBe('');

    const { stdout: log } = await run('git', ['log', '--oneline'], { cwd: root });
    expect(log.trim().split('\n')).toHaveLength(1);
  });

  it('records which session the run used, for the run card (IDEA-255)', async () => {
    const root = await makeGitRoot();
    const git = createGitManager(root);
    const hooks = createAgentHooks(root, git);

    await hooks.annotateFixRun('IDEA-1', 0, {
      kind: 'fix',
      sessionId: 'sess-abc123',
      usage: {
        durationMs: 1500,
        numTurns: 3,
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.01,
      },
    });

    const raw = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    const entry = parseEntityFile(raw).entries[0];
    expect(entry.fixes?.[0].run).toEqual(expect.objectContaining({ sessionId: 'sess-abc123' }));
  });
});

describe('commitBookkeeping', () => {
  async function dirtyRun(root: string) {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'feature.ts'), 'export const x = 1;\n');
    await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), `${PLAN_MD}\nRun note.\n`);
  }

  const plan = { id: 'IDEA-1', title: 'Test plan' };

  async function subjects(root: string): Promise<string[]> {
    const { stdout } = await run('git', ['log', '--format=%s'], { cwd: root });
    return stdout.trim().split('\n');
  }

  async function filesIn(root: string, rev: string): Promise<string[]> {
    const { stdout } = await run('git', ['show', '--name-only', '--format=', rev], { cwd: root });
    return stdout.trim().split('\n');
  }

  async function threadOf(root: string) {
    const raw = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    return parseEntityFile(raw).entries[0].thread ?? [];
  }

  it('commits only the corpus and logs the dirty paths when the run parked', async () => {
    const root = await makeGitRoot();
    const hooks = createAgentHooks(root, createGitManager(root));
    await dirtyRun(root);

    await hooks.commitBookkeeping(plan, 'error', 0);

    expect(await subjects(root)).toEqual(['docs(ideas): IDEA-1 run bookkeeping', 'init']);
    expect((await filesIn(root, 'HEAD')).every((file) => file.startsWith('papercamp/'))).toBe(true);
    const { stdout } = await run('git', ['status', '--porcelain'], { cwd: root });
    expect(stdout).toContain('src/');
    expect((await threadOf(root)).map((message) => message.text).join('\n')).toContain(
      'src/feature.ts',
    );
  });

  it('commits the corpus, then the leftover source under the phase title when the run finished', async () => {
    const root = await makeGitRoot();
    const hooks = createAgentHooks(root, createGitManager(root));
    await dirtyRun(root);

    await hooks.commitBookkeeping(plan, 'done', 0);

    expect(await subjects(root)).toEqual([
      'feat(app): First phase',
      'docs(ideas): IDEA-1 run bookkeeping',
      'init',
    ]);
    expect(await filesIn(root, 'HEAD')).toEqual(['src/feature.ts']);
    expect((await filesIn(root, 'HEAD~1')).every((file) => file.startsWith('papercamp/'))).toBe(
      true,
    );
    const { stdout } = await run('git', ['log', '-1', '--format=%b'], { cwd: root });
    expect(stdout.trim()).toBe('Refs: IDEA-1');
    expect(await threadOf(root)).toEqual([]);
  });

  it('commits nothing and logs nothing when the tree is clean', async () => {
    const root = await makeGitRoot();
    const hooks = createAgentHooks(root, createGitManager(root));

    await hooks.commitBookkeeping(plan, 'error', 0);

    expect(await subjects(root)).toEqual(['init']);
    expect(await threadOf(root)).toEqual([]);
  });
});
