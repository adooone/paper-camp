import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  probeAgentAuthStatus,
  probeCapabilities,
  probeConnections,
  runConnect,
} from './capabilities';

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
  }, 15000);

  it('reports warn when the repo has no user.name/user.email', async () => {
    const root = await initRepo(false);
    const capabilities = await probeCapabilities(root);
    expect(byId(capabilities, 'git').status).toBe('warn');
  }, 15000);

  it('reports ok with the identity when configured', async () => {
    const root = await initRepo(true);
    const capabilities = await probeCapabilities(root);
    const git = byId(capabilities, 'git');
    expect(git.status).toBe('ok');
    expect(git.detail).toBe('Test User <test@example.com>');
  }, 15000);
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
  }, 15000);

  it('reports warn when authenticated but the repo has no origin remote', async () => {
    const root = await initRepo();
    installBin('gh', 'if [ "$1" = "repo" ]; then exit 1; else exit 0; fi');
    const capabilities = await probeCapabilities(root);
    const gh = byId(capabilities, 'gh');
    expect(gh.status).toBe('warn');
    expect(gh.detail).toMatch(/no origin remote/);
  }, 15000);

  it('reports warn when origin is set but unreachable on GitHub', async () => {
    const root = await initRepo();
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/owner/repo.git');
    installBin('gh', 'if [ "$1" = "repo" ]; then exit 1; else exit 0; fi');
    const capabilities = await probeCapabilities(root);
    const gh = byId(capabilities, 'gh');
    expect(gh.status).toBe('warn');
    expect(gh.detail).toMatch(/not reachable/);
  }, 15000);

  it('reports ok when installed, authenticated, and origin is reachable', async () => {
    const root = await initRepo();
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/owner/repo.git');
    installBin('gh', 'exit 0');
    const capabilities = await probeCapabilities(root);
    const gh = byId(capabilities, 'gh');
    expect(gh.status).toBe('ok');
    expect(gh.detail).toBe('https://example.invalid/owner/repo.git');
  }, 15000);
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

function byConnId(connections: Awaited<ReturnType<typeof probeConnections>>, id: string) {
  const found = connections.find((c) => c.id === id);
  if (!found) throw new Error(`no connection with id ${id}`);
  return found;
}

describe('probeConnections', () => {
  it('reports git as never authenticated, regardless of status', async () => {
    const root = await initRepo(false);
    const connections = await probeConnections(root);
    const git = byConnId(connections, 'git');
    expect(git.status).toBe('warn');
    expect(git.authenticated).toBeNull();
    expect(git.label).toBe('Git');
  }, 15000);

  it('reports gh as unauthenticated null when not installed', async () => {
    const root = await initRepo();
    process.env.PATH = '/nonexistent';
    const connections = await probeConnections(root);
    expect(byConnId(connections, 'gh').authenticated).toBeNull();
  });

  it('reports gh as authenticated false when installed but signed out', async () => {
    const root = await initRepo();
    installBin('gh', 'if [ "$1" = "--version" ]; then exit 0; else exit 1; fi');
    const connections = await probeConnections(root);
    expect(byConnId(connections, 'gh').authenticated).toBe(false);
  });

  it('reports gh as authenticated true when signed in', async () => {
    const root = await initRepo();
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/owner/repo.git');
    installBin('gh', 'exit 0');
    const connections = await probeConnections(root);
    expect(byConnId(connections, 'gh').authenticated).toBe(true);
  }, 15000);

  it('reports claude-code as authenticated using the claude auth status probe', async () => {
    const root = await initRepo();
    installBin(
      'claude',
      `echo '{"loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty"}'`,
    );
    const connections = await probeConnections(root);
    expect(byConnId(connections, 'agent:claude-code').authenticated).toBe(true);
  });

  it('reports opencode as unauthenticated null — it has no auth status probe', async () => {
    const root = await initRepo();
    installBin('opencode', "echo '9.9.9'");
    const connections = await probeConnections(root);
    expect(byConnId(connections, 'agent:opencode').authenticated).toBeNull();
  });
});

describe('probeConnections: connect action', () => {
  it('offers a runnable git init command when the directory is not a git repo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'papercamp-cap-noropo-'));
    roots.push(root);
    const connections = await probeConnections(root);
    expect(byConnId(connections, 'git').connect).toEqual({
      kind: 'command',
      command: 'git init',
      runnable: true,
    });
  }, 15000);

  it('offers gh auth login as a non-runnable command when signed out', async () => {
    const root = await initRepo();
    installBin('gh', 'if [ "$1" = "--version" ]; then exit 0; else exit 1; fi');
    const connections = await probeConnections(root);
    expect(byConnId(connections, 'gh').connect).toEqual({
      kind: 'command',
      command: 'gh auth login',
    });
  }, 15000);

  it('offers no connect action once a service is ok', async () => {
    const root = await initRepo();
    const connections = await probeConnections(root);
    expect(byConnId(connections, 'git').connect).toBeNull();
  }, 15000);
});

describe('runConnect', () => {
  it('returns null for an unknown service id', async () => {
    const root = await initRepo();
    expect(await runConnect('nope', root)).toBeNull();
  });

  it('runs a runnable command and reports the refreshed status', async () => {
    const root = await mkdtemp(join(tmpdir(), 'papercamp-cap-noropo-'));
    roots.push(root);
    const connection = await runConnect('git', root);
    expect(connection?.status).not.toBe('missing');
    expect(connection?.connect).not.toEqual(expect.objectContaining({ command: 'git init' }));
  }, 15000);

  it('leaves a non-runnable command untouched — gh stays unauthenticated', async () => {
    const root = await initRepo();
    installBin('gh', 'if [ "$1" = "--version" ]; then exit 0; else exit 1; fi');
    const connection = await runConnect('gh', root);
    expect(connection?.authenticated).toBe(false);
    expect(connection?.connect).toEqual({ kind: 'command', command: 'gh auth login' });
  }, 15000);
});

describe('probeAgentAuthStatus', () => {
  it('reports unknown for an agent other than claude-code', async () => {
    const root = await initRepo();
    const status = await probeAgentAuthStatus('opencode', root);
    expect(status).toEqual({ loggedIn: null, authMethod: null, apiProvider: null });
  });

  it('reports unknown when the claude CLI is not on PATH', async () => {
    const root = await initRepo();
    process.env.PATH = '/nonexistent';
    const status = await probeAgentAuthStatus('claude-code', root);
    expect(status).toEqual({ loggedIn: null, authMethod: null, apiProvider: null });
  });

  it('reports unknown when `claude auth status` exits non-zero', async () => {
    const root = await initRepo();
    installBin('claude', 'exit 1');
    const status = await probeAgentAuthStatus('claude-code', root);
    expect(status).toEqual({ loggedIn: null, authMethod: null, apiProvider: null });
  });

  it('reports unknown when `claude auth status` prints unparsable output', async () => {
    const root = await initRepo();
    installBin('claude', "echo 'not json'");
    const status = await probeAgentAuthStatus('claude-code', root);
    expect(status).toEqual({ loggedIn: null, authMethod: null, apiProvider: null });
  });

  it('reports the parsed auth state when logged in', async () => {
    const root = await initRepo();
    installBin(
      'claude',
      `echo '{"loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty"}'`,
    );
    const status = await probeAgentAuthStatus('claude-code', root);
    expect(status).toEqual({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' });
  });

  it('reports the parsed auth state when logged out', async () => {
    const root = await initRepo();
    installBin('claude', `echo '{"loggedIn": false, "authMethod": null, "apiProvider": null}'`);
    const status = await probeAgentAuthStatus('claude-code', root);
    expect(status).toEqual({ loggedIn: false, authMethod: null, apiProvider: null });
  });
});
