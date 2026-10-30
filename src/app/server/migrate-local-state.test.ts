import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCapacity } from '@/core/capacity';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateLocalState } from './migrate-local-state';
import { loadPairingState } from './pairing';

// Shells out to the real git binary, like git.test.ts — the behavior this file guards
// (untracking, a mid-rebase skip, a real commit) only shows up against a real repo.
const roots: string[] = [];
let configDir: string;

beforeEach(async () => {
  configDir = await mkdtemp(join(tmpdir(), 'papercamp-migrate-config-'));
  roots.push(configDir);
  vi.stubEnv('PAPERCAMP_CONFIG_DIR', configDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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

async function initRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-migrate-repo-'));
  roots.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  await mkdir(join(root, 'papercamp'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'config.json'), '{}\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'initial commit');
  return root;
}

describe('migrateLocalState', () => {
  it('is a no-op on the second run, once the first has landed its commit', async () => {
    const root = await initRepo();
    await migrateLocalState(root);
    const result = await migrateLocalState(root);
    expect(result).toEqual({ status: 'no-op', rotatedPairingToken: false, adoptedCapacity: false });
  });

  it('moves a committed local file into .local/, untracks it, and commits once', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'papercamp', 'run-order.md'), '- FEAT-1\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'add run order');

    const result = await migrateLocalState(root);
    expect(result.status).toBe('migrated');

    await expect(readFile(join(root, 'papercamp', 'run-order.md'), 'utf-8')).rejects.toThrow();
    const moved = await readFile(join(root, 'papercamp', '.local', 'run-order.md'), 'utf-8');
    expect(moved).toBe('- FEAT-1\n');

    expect(git(root, 'ls-files', 'papercamp/run-order.md')).toBe('');
    expect(git(root, 'log', '-1', '--format=%s')).toBe(
      'chore(papercamp): Move local state to papercamp/.local',
    );
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  it('untracks a file already committed under .local/ and makes .local/ ignore itself', async () => {
    const root = await initRepo();
    await mkdir(join(root, 'papercamp', '.local'), { recursive: true });
    await writeFile(join(root, 'papercamp', '.local', 'pr-map.json'), '{}\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'commit local state by mistake');

    const result = await migrateLocalState(root);
    expect(result.status).toBe('migrated');

    expect(git(root, 'ls-files', 'papercamp/.local')).toBe('');
    await expect(readFile(join(root, 'papercamp', '.local', 'pr-map.json'), 'utf-8')).resolves.toBe(
      '{}\n',
    );
    await writeFile(join(root, 'papercamp', '.local', 'pr-map.json'), '{"changed":true}\n');
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  it('creates the .local/ ignore file on a checkout with nothing to move', async () => {
    const root = await initRepo();
    await migrateLocalState(root);
    await expect(readFile(join(root, 'papercamp', '.local', '.gitignore'), 'utf-8')).resolves.toBe(
      '*\n',
    );
    await writeFile(join(root, 'papercamp', '.local', 'tasks.log'), 'x\n');
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  it('drops the matching .gitignore line and comment, leaving others alone', async () => {
    const root = await initRepo();
    await writeFile(
      join(root, '.gitignore'),
      'node_modules\n# Local queue order, never shared.\npapercamp/run-order.md\npapercamp/tasks.log\n',
    );
    await writeFile(join(root, 'papercamp', 'run-order.md'), 'content\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'add run order and gitignore');

    await migrateLocalState(root);

    const gitignore = await readFile(join(root, '.gitignore'), 'utf-8');
    expect(gitignore).toBe('node_modules\n');
  });

  it('writes the chat.md merge=union block into .gitattributes, once', async () => {
    const root = await initRepo();
    await migrateLocalState(root);
    const before = await readFile(join(root, '.gitattributes'), 'utf-8');
    expect(before).toContain('papercamp/chat.md merge=union');

    git(root, 'add', '.');
    git(root, 'commit', '-m', 'commit the attributes block', '--allow-empty');
    await migrateLocalState(root);
    const after = await readFile(join(root, '.gitattributes'), 'utf-8');
    expect(after).toBe(before);
  });

  it('removes a plan file name from .gitignore even outside DAEMON_GITIGNORE_ENTRIES', async () => {
    const root = await initRepo();
    await writeFile(join(root, '.gitignore'), 'node_modules\npapercamp/chat.md\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'wrongly ignore chat.md');

    await migrateLocalState(root);

    const gitignore = await readFile(join(root, '.gitignore'), 'utf-8');
    expect(gitignore).toBe('node_modules\n');
  });

  it('skips a project mid-rebase, leaving the working tree untouched', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'papercamp', 'tasks.log'), 'line one\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'add tasks log');
    git(root, 'checkout', '-b', 'feature');
    await writeFile(join(root, 'papercamp', 'tasks.log'), 'feature line\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'feature change');
    git(root, 'checkout', 'main');
    await writeFile(join(root, 'papercamp', 'tasks.log'), 'main line\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'main change');
    git(root, 'checkout', 'feature');
    spawnSync('git', ['rebase', 'main'], { cwd: root });

    const result = await migrateLocalState(root);
    expect(result).toEqual({
      status: 'skipped',
      skipReason: 'rebase-in-progress',
      rotatedPairingToken: false,
      adoptedCapacity: false,
    });
    expect(
      await readFile(join(root, 'papercamp', 'tasks.log'), 'utf-8').catch(() => null),
    ).not.toBeNull();
  });

  it('skips a project with staged changes', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'papercamp', 'run-order.md'), 'content\n');
    git(root, 'add', '.');

    const result = await migrateLocalState(root);
    expect(result.status).toBe('skipped');
    expect(result.skipReason).toBe('staged-changes');
    await expect(readFile(join(root, 'papercamp', 'run-order.md'), 'utf-8')).resolves.toBe(
      'content\n',
    );
  });

  it('rotates the pairing token when the old file was ever committed, even on GitHub', async () => {
    const root = await initRepo();
    await writeFile(
      join(root, 'papercamp', '.pairing.json'),
      `${JSON.stringify({ token: 'leaked-token', origins: [] })}\n`,
    );
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'commit the pairing token by mistake');

    const result = await migrateLocalState(root);
    expect(result.rotatedPairingToken).toBe(true);

    const state = await loadPairingState(join(root, 'papercamp', '.local', 'pairing.json'));
    expect(state?.token).not.toBe('leaked-token');
    expect(state?.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('moves a local-only pairing file without rotating when it was never committed', async () => {
    const root = await initRepo();
    await mkdir(join(root, 'papercamp'), { recursive: true });
    await writeFile(
      join(root, 'papercamp', '.pairing.json'),
      `${JSON.stringify({ token: 'still-local-token', origins: [] })}\n`,
    );

    const result = await migrateLocalState(root);
    expect(result.rotatedPairingToken).toBe(false);

    const state = await loadPairingState(join(root, 'papercamp', '.local', 'pairing.json'));
    expect(state?.token).toBe('still-local-token');
  });

  it('adopts a committed capacity.json into the machine config dir and removes it', async () => {
    const root = await initRepo();
    const record = {
      snapshot: { fiveHour: { used: 1, limit: 10 } },
      capturedAt: '2026-10-28T00:00:00.000Z',
      source: 'probe',
    };
    await writeFile(join(root, 'papercamp', 'capacity.json'), `${JSON.stringify(record)}\n`);
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'commit capacity.json by mistake');

    const result = await migrateLocalState(root);
    expect(result.adoptedCapacity).toBe(true);
    await expect(readFile(join(root, 'papercamp', 'capacity.json'), 'utf-8')).rejects.toThrow();

    const adopted = await readCapacity();
    expect(adopted?.capturedAt).toBe(record.capturedAt);
  });

  it('keeps the newer capacity.json when the machine copy is already newer', async () => {
    const root = await initRepo();
    const older = {
      snapshot: { fiveHour: { used: 1, limit: 10 } },
      capturedAt: '2020-01-01T00:00:00.000Z',
      source: 'probe',
    };
    await writeFile(join(root, 'papercamp', 'capacity.json'), `${JSON.stringify(older)}\n`);
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'commit an old capacity.json');

    const { writeCapacity } = await import('@/core/capacity');
    await writeCapacity({ fiveHour: { used: 2, limit: 10 } } as never, 'run');
    const before = await readCapacity();

    const result = await migrateLocalState(root);
    expect(result.adoptedCapacity).toBe(false);
    const after = await readCapacity();
    expect(after?.capturedAt).toBe(before?.capturedAt);
  });
});
