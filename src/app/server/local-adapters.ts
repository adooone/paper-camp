import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentAuthStatus, AgentId, CapabilityResult, ConnectAction } from '../../types';
import { AGENT_IDS, AGENT_LABELS } from '../../types';
import { AGENTS } from './agents';
import { readMaybe } from './helpers';
import { run } from './run';

// Tools the runtime drives on the machine (git, claude-code, opencode); each keeps its
// own credential locally on this machine, never a remote account tied to Paper Camp.
export interface LocalAdapterDefinition {
  id: string;
  label: string;
  unlocks: string;
  probe: (root: string) => Promise<CapabilityResult>;
  /** Null once the adapter probes `ok` — nothing to connect. */
  connect: (result: CapabilityResult) => ConnectAction | null;
  signedIn: (root: string) => Promise<boolean | null>;
  /** Only claude-code implements this — whether headless runs actually see this repo's allowlist. */
  trustDialogAccepted?: (root: string) => Promise<boolean>;
}

// Paper Camp never writes ~/.claude.json — it's only opened once, interactively, by
// `claude` itself; a missing entry means the trust dialog was never accepted here.
export async function claudeTrustDialogAccepted(root: string): Promise<boolean> {
  const raw = await readMaybe(join(homedir(), '.claude.json'));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as {
      projects?: Record<string, { hasTrustDialogAccepted?: boolean }>;
    };
    return parsed.projects?.[root]?.hasTrustDialogAccepted === true;
  } catch {
    return false;
  }
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

async function gitSignedIn(): Promise<boolean | null> {
  return null;
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

async function agentSignedIn(id: AgentId, root: string): Promise<boolean | null> {
  if (id !== 'claude-code') return null;
  const status = await claudeAuthStatus(root);
  return status?.loggedIn ?? null;
}

export const LOCAL_ADAPTERS: LocalAdapterDefinition[] = [
  {
    id: 'git',
    label: 'Git',
    unlocks: 'Commits, phase logging, branch creation',
    probe: probeGit,
    connect: gitConnect,
    signedIn: gitSignedIn,
  },
  ...AGENT_IDS.map((id) => ({
    id: `agent:${id}`,
    label: `${AGENT_LABELS[id]} CLI`,
    unlocks: `Launching ${AGENT_LABELS[id]} for phase runs, drafts, and reviews`,
    probe: (root: string) => probeAgent(id, root),
    connect: (result: CapabilityResult) => agentConnect(id, result),
    signedIn: (root: string) => agentSignedIn(id, root),
    ...(id === 'claude-code' ? { trustDialogAccepted: claudeTrustDialogAccepted } : {}),
  })),
];
