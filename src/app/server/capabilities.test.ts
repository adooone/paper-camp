import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { probeCapabilities } from './capabilities';

const originalPath = process.env.PATH;
const originalHome = process.env.HOME;
const roots: string[] = [];

/** Prepends a fake executable named `name` running `script` onto PATH. */
function installBin(name: string, script: string): void {
  const dir = mkdtempSync(join(tmpdir(), `papercamp-cap-bin-${name}-`));
  writeFileSync(join(dir, name), `#!/bin/sh\n${script}\n`);
  chmodSync(join(dir, name), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
}

async function initRepo(withIdentity = true): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-cap-repo-'));
  roots.push(root);
  git(root, 'init', '-b', 'main');
  if (withIdentity) {
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test User');
  }
  return root;
}

function byId(capabilities: Awaited<ReturnType<typeof probeCapabilities>>, id: string) {
  const found = capabilities.find((c) => c.id === id);
  if (!found) throw new Error(`no capability with id ${id}`);
  return found;
}

// git config falls back to a machine-wide/global config, so identity tests point
// HOME at an empty dir to isolate them from whatever is set on the test machine.
beforeEach(async () => {
  const home = await mkdtemp(join(tmpdir(), 'papercamp-cap-home-'));
  roots.push(home);
  process.env.HOME = home;
});

afterEach(async () => {
  process.env.PATH = originalPath;
  process.env.HOME = originalHome;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('probeCapabilities: git', () => {
  it('reports missing when the directory is not a git repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'papercamp-cap-noropo-'));
    roots.push(root);
    const capabilities = await probeCapabilities(root);
    expect(byId(capabilities, 'git').status).toBe('missing');
  });

  it('reports warn when the repo has no user.name/user.email', async () => {
    const root = await initRepo(false);
    const capabilities = await probeCapabilities(root);
    expect(byId(capabilities, 'git').status).toBe('warn');
  });

  it('reports ok with the identity when configured', async () => {
    const root = await initRepo(true);
    const capabilities = await probeCapabilities(root);
    const git = byId(capabilities, 'git');
    expect(git.status).toBe('ok');
    expect(git.detail).toBe('Test User <test@example.com>');
  });
});

describe('probeCapabilities: gh', () => {
  it('reports missing when gh is not on PATH', async () => {
    const root = await initRepo();
    process.env.PATH = '/nonexistent';
    const capabilities = await probeCapabilities(root);
    expect(byId(capabilities, 'gh').status).toBe('missing');
  });

  it('reports warn when gh is installed but not authenticated', async () => {
    const root = await initRepo();
    installBin('gh', 'if [ "$1" = "--version" ]; then exit 0; else exit 1; fi');
    const capabilities = await probeCapabilities(root);
    expect(byId(capabilities, 'gh').status).toBe('warn');
  });

  it('reports warn when authenticated but the repo has no origin remote', async () => {
    const root = await initRepo();
    installBin('gh', 'if [ "$1" = "repo" ]; then exit 1; else exit 0; fi');
    const capabilities = await probeCapabilities(root);
    const gh = byId(capabilities, 'gh');
    expect(gh.status).toBe('warn');
    expect(gh.detail).toMatch(/no origin remote/);
  });

  it('reports warn when origin is set but unreachable on GitHub', async () => {
    const root = await initRepo();
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/owner/repo.git');
    installBin('gh', 'if [ "$1" = "repo" ]; then exit 1; else exit 0; fi');
    const capabilities = await probeCapabilities(root);
    const gh = byId(capabilities, 'gh');
    expect(gh.status).toBe('warn');
    expect(gh.detail).toMatch(/not reachable/);
  });

  it('reports ok when installed, authenticated, and origin is reachable', async () => {
    const root = await initRepo();
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/owner/repo.git');
    installBin('gh', 'exit 0');
    const capabilities = await probeCapabilities(root);
    const gh = byId(capabilities, 'gh');
    expect(gh.status).toBe('ok');
    expect(gh.detail).toBe('https://example.invalid/owner/repo.git');
  });
});

describe('probeCapabilities: agent adapters', () => {
  it('reports missing when an agent CLI is not on PATH', async () => {
    const root = await initRepo();
    process.env.PATH = '/nonexistent';
    const capabilities = await probeCapabilities(root);
    expect(byId(capabilities, 'agent:claude-code').status).toBe('missing');
    expect(byId(capabilities, 'agent:opencode').status).toBe('missing');
  });

  it('reports ok with the reported version when an agent CLI is present', async () => {
    const root = await initRepo();
    installBin('claude', "echo '1.2.3 (Claude Code)'");
    installBin('opencode', "echo '9.9.9'");
    const capabilities = await probeCapabilities(root);
    expect(byId(capabilities, 'agent:claude-code')).toEqual({
      id: 'agent:claude-code',
      status: 'ok',
      detail: '1.2.3 (Claude Code)',
    });
    expect(byId(capabilities, 'agent:opencode')).toEqual({
      id: 'agent:opencode',
      status: 'ok',
      detail: '9.9.9',
    });
  });
});
