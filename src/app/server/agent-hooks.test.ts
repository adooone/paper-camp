import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { parseEntityFile } from '@/core/parse';
import { afterAll, describe, expect, it } from 'vitest';
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
});
