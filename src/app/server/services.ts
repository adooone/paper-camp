import type { AgentAuthStatus, AgentId, CapabilityResult, ConnectAction } from '../../types';
import { AGENT_IDS, AGENT_LABELS } from '../../types';
import { AGENTS } from './agents';
import { run } from './run';

export type { ProbeResult } from './run';
export { run } from './run';

export interface ServiceDefinition {
  id: string;
  label: string;
  unlocks: string;
  probe: (root: string) => Promise<CapabilityResult>;
  /** Null once the service probes `ok` — nothing to connect. */
  connect: (result: CapabilityResult) => ConnectAction | null;
  authenticated: (root: string) => Promise<boolean | null>;
}

export async function claudeAuthStatus(root: string): Promise<AgentAuthStatus | null> {
  const result = await run('claude', ['auth', 'status'], root);
  if (result.code !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout) as Partial<AgentAuthStatus>;
    return {
      loggedIn: typeof parsed.loggedIn === 'boolean' ? parsed.loggedIn : null,
      authMethod: typeof parsed.authMethod === 'string' ? parsed.authMethod : null,
      apiProvider: typeof parsed.apiProvider === 'string' ? parsed.apiProvider : null,
    };
  } catch {
    return null;
  }
}

async function probeGit(root: string): Promise<CapabilityResult> {
  const repo = await run('git', ['rev-parse', '--is-inside-work-tree'], root);
  if (repo.code !== 0) {
    return { id: 'git', status: 'missing', detail: 'Not inside a git repository' };
  }
  const [name, email] = await Promise.all([
    run('git', ['config', 'user.name'], root),
    run('git', ['config', 'user.email'], root),
  ]);
  if (!name.stdout.trim() || !email.stdout.trim()) {
    return {
      id: 'git',
      status: 'warn',
      detail: 'Repository found, but user.name/user.email is not set',
    };
  }
  return { id: 'git', status: 'ok', detail: `${name.stdout.trim()} <${email.stdout.trim()}>` };
}

function gitConnect(result: CapabilityResult): ConnectAction | null {
  if (result.status === 'missing') {
    return { kind: 'command', command: 'git init', runnable: true };
  }
  if (result.status === 'warn') {
    return {
      kind: 'command',
      command: 'git config user.name "Your Name" && git config user.email you@example.com',
    };
  }
  return null;
}

async function gitAuthenticated(): Promise<boolean | null> {
  return null;
}

async function probeGh(root: string): Promise<CapabilityResult> {
  const version = await run('gh', ['--version'], root);
  if (version.code !== 0) {
    return { id: 'gh', status: 'missing', detail: 'gh CLI not found on PATH' };
  }
  const auth = await run('gh', ['auth', 'status'], root);
  if (auth.code !== 0) {
    return { id: 'gh', status: 'warn', detail: 'gh is installed but not authenticated' };
  }
  const origin = await run('git', ['remote', 'get-url', 'origin'], root);
  if (origin.code !== 0) {
    return {
      id: 'gh',
      status: 'warn',
      detail: 'Authenticated, but repository has no origin remote',
    };
  }
  const repoView = await run('gh', ['repo', 'view', '--json', 'nameWithOwner'], root);
  if (repoView.code !== 0) {
    return {
      id: 'gh',
      status: 'warn',
      detail: 'Authenticated, but origin is not reachable on GitHub',
    };
  }
  return { id: 'gh', status: 'ok', detail: origin.stdout.trim() };
}

function ghConnect(result: CapabilityResult): ConnectAction | null {
  if (result.status === 'missing') {
    return { kind: 'link', url: 'https://cli.github.com', label: 'Install the GitHub CLI' };
  }
  if (result.status === 'warn') {
    if (result.detail.includes('no origin remote')) {
      return { kind: 'command', command: 'git remote add origin <url>' };
    }
    if (result.detail.includes('not reachable')) {
      return { kind: 'command', command: 'gh repo view' };
    }
    return { kind: 'command', command: 'gh auth login' };
  }
  return null;
}

async function ghAuthenticated(root: string): Promise<boolean | null> {
  const version = await run('gh', ['--version'], root);
  if (version.code !== 0) return null;
  const auth = await run('gh', ['auth', 'status'], root);
  return auth.code === 0;
}

async function probeAgent(id: AgentId, root: string): Promise<CapabilityResult> {
  const { command } = AGENTS[id];
  const result = await run(command, ['--version'], root);
  if (result.code !== 0) {
    return { id: `agent:${id}`, status: 'missing', detail: `${command} not found on PATH` };
  }
  const version = (result.stdout || result.stderr).trim().split('\n')[0];
  return { id: `agent:${id}`, status: 'ok', detail: version || command };
}

function agentConnect(id: AgentId, result: CapabilityResult): ConnectAction | null {
  if (result.status === 'ok') return null;
  return { kind: 'text', message: `Install the ${AGENT_LABELS[id]} CLI and add it to PATH` };
}

async function agentAuthenticated(id: AgentId, root: string): Promise<boolean | null> {
  if (id !== 'claude-code') return null;
  const status = await claudeAuthStatus(root);
  return status?.loggedIn ?? null;
}

export const SERVICES: ServiceDefinition[] = [
  {
    id: 'git',
    label: 'Git',
    unlocks: 'Commits, phase logging, branch creation',
    probe: probeGit,
    connect: gitConnect,
    authenticated: gitAuthenticated,
  },
  {
    id: 'gh',
    label: 'GitHub CLI',
    unlocks: 'PR badges, review flow, fix-review',
    probe: probeGh,
    connect: ghConnect,
    authenticated: ghAuthenticated,
  },
  ...AGENT_IDS.map((id) => ({
    id: `agent:${id}`,
    label: `${AGENT_LABELS[id]} CLI`,
    unlocks: `Launching ${AGENT_LABELS[id]} for phase runs, drafts, and reviews`,
    probe: (root: string) => probeAgent(id, root),
    connect: (result: CapabilityResult) => agentConnect(id, result),
    authenticated: (root: string) => agentAuthenticated(id, root),
  })),
];
