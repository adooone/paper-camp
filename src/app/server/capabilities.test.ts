import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  probeAgentAuthStatus,
  probeCapabilities,
  probeConnections,
  runConnect,
} from './capabilities';

// Every service probes through `run` (src/app/server/run.ts). Mocking that single
// choke point keeps these tests to in-memory dispatch — no real subprocesses, no
// temp git repos, no PATH shims. A per-command handler stands in for a fake binary;
// `git` is stateful so the `git init` connect flow can flip an empty dir into a repo.
type RunResult = { code: number | null; stdout: string; stderr: string };

const mock = vi.hoisted(() => {
  const ok = (stdout = ''): RunResult => ({ code: 0, stdout, stderr: '' });
  const fail = (stderr = ''): RunResult => ({ code: 1, stdout: '', stderr });
  const notInstalled: RunResult = { code: null, stdout: '', stderr: '' };
  const bins = new Map<string, (args: string[]) => RunResult>();
  const git = { inRepo: true, name: 'Test User', email: 'test@example.com', origin: '' };

  function dispatch(command: string, args: string[]): RunResult {
    if (command === 'git') {
      const sub = args.join(' ');
      if (sub === 'rev-parse --is-inside-work-tree') return git.inRepo ? ok('true') : fail();
      if (sub === 'config user.name') return ok(git.name);
      if (sub === 'config user.email') return ok(git.email);
      if (sub === 'remote get-url origin') return git.origin ? ok(git.origin) : fail();
      if (sub === 'init') {
        git.inRepo = true;
        return ok();
      }
      return fail();
    }
    return bins.get(command)?.(args) ?? notInstalled;
  }

  return {
    ok,
    fail,
    git,
    dispatch,
    bin: (name: string, handler: (args: string[]) => RunResult) => bins.set(name, handler),
    reset: () => {
      bins.clear();
      Object.assign(git, {
        inRepo: true,
        name: 'Test User',
        email: 'test@example.com',
        origin: '',
      });
    },
  };
});

vi.mock('./run', () => ({
  run: (command: string, args: string[]) => Promise.resolve(mock.dispatch(command, args)),
}));

const ROOT = '/repo';

beforeEach(() => {
  mock.reset();
});

function byId(capabilities: Awaited<ReturnType<typeof probeCapabilities>>, id: string) {
  const found = capabilities.find((c) => c.id === id);
  if (!found) throw new Error(`no capability with id ${id}`);
  return found;
}

describe('probeCapabilities: git', () => {
  it('reports missing when the directory is not a git repository', async () => {
    mock.git.inRepo = false;
    expect(byId(await probeCapabilities(ROOT), 'git').status).toBe('missing');
  });

  it('reports warn when the repo has no user.name/user.email', async () => {
    mock.git.name = '';
    mock.git.email = '';
    expect(byId(await probeCapabilities(ROOT), 'git').status).toBe('warn');
  });

  it('reports ok with the identity when configured', async () => {
    const git = byId(await probeCapabilities(ROOT), 'git');
    expect(git.status).toBe('ok');
    expect(git.detail).toBe('Test User <test@example.com>');
  });
});

describe('probeCapabilities: gh', () => {
  it('reports missing when gh is not on PATH', async () => {
    expect(byId(await probeCapabilities(ROOT), 'gh').status).toBe('missing');
  });

  it('reports warn when gh is installed but not authenticated', async () => {
    mock.bin('gh', (args) => (args[0] === '--version' ? mock.ok() : mock.fail()));
    expect(byId(await probeCapabilities(ROOT), 'gh').status).toBe('warn');
  });

  it('reports warn when authenticated but the repo has no origin remote', async () => {
    mock.bin('gh', () => mock.ok());
    const gh = byId(await probeCapabilities(ROOT), 'gh');
    expect(gh.status).toBe('warn');
    expect(gh.detail).toMatch(/no origin remote/);
  });

  it('reports warn when origin is set but unreachable on GitHub', async () => {
    mock.git.origin = 'https://example.invalid/owner/repo.git';
    mock.bin('gh', (args) => (args[0] === 'repo' ? mock.fail() : mock.ok()));
    const gh = byId(await probeCapabilities(ROOT), 'gh');
    expect(gh.status).toBe('warn');
    expect(gh.detail).toMatch(/not reachable/);
  });

  it('reports ok when installed, authenticated, and origin is reachable', async () => {
    mock.git.origin = 'https://example.invalid/owner/repo.git';
    mock.bin('gh', () => mock.ok());
    const gh = byId(await probeCapabilities(ROOT), 'gh');
    expect(gh.status).toBe('ok');
    expect(gh.detail).toBe('https://example.invalid/owner/repo.git');
  });
});

describe('probeCapabilities: agent adapters', () => {
  it('reports missing when an agent CLI is not on PATH', async () => {
    const capabilities = await probeCapabilities(ROOT);
    expect(byId(capabilities, 'agent:claude-code').status).toBe('missing');
    expect(byId(capabilities, 'agent:opencode').status).toBe('missing');
  });

  it('reports ok with the reported version when an agent CLI is present', async () => {
    mock.bin('claude', () => mock.ok('1.2.3 (Claude Code)'));
    mock.bin('opencode', () => mock.ok('9.9.9'));
    const capabilities = await probeCapabilities(ROOT);
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
    mock.git.name = '';
    mock.git.email = '';
    const git = byConnId(await probeConnections(ROOT), 'git');
    expect(git.status).toBe('warn');
    expect(git.authenticated).toBeNull();
    expect(git.label).toBe('Git');
  });

  it('reports gh as unauthenticated null when not installed', async () => {
    expect(byConnId(await probeConnections(ROOT), 'gh').authenticated).toBeNull();
  });

  it('reports gh as authenticated false when installed but signed out', async () => {
    mock.bin('gh', (args) => (args[0] === '--version' ? mock.ok() : mock.fail()));
    expect(byConnId(await probeConnections(ROOT), 'gh').authenticated).toBe(false);
  });

  it('reports gh as authenticated true when signed in', async () => {
    mock.git.origin = 'https://example.invalid/owner/repo.git';
    mock.bin('gh', () => mock.ok());
    expect(byConnId(await probeConnections(ROOT), 'gh').authenticated).toBe(true);
  });

  it('reports claude-code as authenticated using the claude auth status probe', async () => {
    mock.bin('claude', () =>
      mock.ok('{"loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty"}'),
    );
    expect(byConnId(await probeConnections(ROOT), 'agent:claude-code').authenticated).toBe(true);
  });

  it('reports opencode as unauthenticated null — it has no auth status probe', async () => {
    mock.bin('opencode', () => mock.ok('9.9.9'));
    expect(byConnId(await probeConnections(ROOT), 'agent:opencode').authenticated).toBeNull();
  });
});

describe('probeConnections: connect action', () => {
  it('offers a runnable git init command when the directory is not a git repo', async () => {
    mock.git.inRepo = false;
    expect(byConnId(await probeConnections(ROOT), 'git').connect).toEqual({
      kind: 'command',
      command: 'git init',
      runnable: true,
    });
  });

  it('offers gh auth login as a non-runnable command when signed out', async () => {
    mock.bin('gh', (args) => (args[0] === '--version' ? mock.ok() : mock.fail()));
    expect(byConnId(await probeConnections(ROOT), 'gh').connect).toEqual({
      kind: 'command',
      command: 'gh auth login',
    });
  });

  it('offers no connect action once a service is ok', async () => {
    expect(byConnId(await probeConnections(ROOT), 'git').connect).toBeNull();
  });
});

describe('runConnect', () => {
  it('returns null for an unknown service id', async () => {
    expect(await runConnect('nope', ROOT)).toBeNull();
  });

  it('runs a runnable command and reports the refreshed status', async () => {
    mock.git.inRepo = false;
    const connection = await runConnect('git', ROOT);
    expect(connection?.status).not.toBe('missing');
    expect(connection?.connect).not.toEqual(expect.objectContaining({ command: 'git init' }));
  });

  it('leaves a non-runnable command untouched — gh stays unauthenticated', async () => {
    mock.bin('gh', (args) => (args[0] === '--version' ? mock.ok() : mock.fail()));
    const connection = await runConnect('gh', ROOT);
    expect(connection?.authenticated).toBe(false);
    expect(connection?.connect).toEqual({ kind: 'command', command: 'gh auth login' });
  });
});

describe('probeAgentAuthStatus', () => {
  it('reports unknown for an agent other than claude-code', async () => {
    expect(await probeAgentAuthStatus('opencode', ROOT)).toEqual({
      loggedIn: null,
      authMethod: null,
      apiProvider: null,
    });
  });

  it('reports unknown when the claude CLI is not on PATH', async () => {
    expect(await probeAgentAuthStatus('claude-code', ROOT)).toEqual({
      loggedIn: null,
      authMethod: null,
      apiProvider: null,
    });
  });

  it('reports unknown when `claude auth status` exits non-zero', async () => {
    mock.bin('claude', () => mock.fail());
    expect(await probeAgentAuthStatus('claude-code', ROOT)).toEqual({
      loggedIn: null,
      authMethod: null,
      apiProvider: null,
    });
  });

  it('reports unknown when `claude auth status` prints unparsable output', async () => {
    mock.bin('claude', () => mock.ok('not json'));
    expect(await probeAgentAuthStatus('claude-code', ROOT)).toEqual({
      loggedIn: null,
      authMethod: null,
      apiProvider: null,
    });
  });

  it('reports the parsed auth state when logged in', async () => {
    mock.bin('claude', () =>
      mock.ok('{"loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty"}'),
    );
    expect(await probeAgentAuthStatus('claude-code', ROOT)).toEqual({
      loggedIn: true,
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
    });
  });

  it('reports the parsed auth state when logged out', async () => {
    mock.bin('claude', () =>
      mock.ok('{"loggedIn": false, "authMethod": null, "apiProvider": null}'),
    );
    expect(await probeAgentAuthStatus('claude-code', ROOT)).toEqual({
      loggedIn: false,
      authMethod: null,
      apiProvider: null,
    });
  });
});
