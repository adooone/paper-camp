import type { AgentAuthStatus, AgentId, CapabilityResult, ConnectionResult } from '../../types';
import { EXTERNAL_SERVICES, type ExternalServiceDefinition } from './external-services';
import {
  CLAUDE_AUTH_STATUS_ARGS,
  LOCAL_ADAPTERS,
  type LocalAdapterDefinition,
  machineClaudeAuthStatus,
} from './local-adapters';
import { clearProbe } from './probe-cache';
import { type ProbeExec, type ProbeResult, run } from './run';

type Plugin =
  | { kind: 'external'; def: ExternalServiceDefinition }
  | { kind: 'local'; def: LocalAdapterDefinition };

const PLUGINS: Plugin[] = [
  ...EXTERNAL_SERVICES.map((def) => ({ kind: 'external' as const, def })),
  ...LOCAL_ADAPTERS.map((def) => ({ kind: 'local' as const, def })),
];

// The one place the two credential stores meet: external services report remote-account
// auth, local adapters local-session sign-in — different things, same client rendering.
function authState(plugin: Plugin, exec: ProbeExec): Promise<boolean | null> {
  return plugin.kind === 'external' ? plugin.def.authenticated(exec) : plugin.def.signedIn(exec);
}

// null for anything but claude-code, which is the only adapter with a trust dialog to check.
function trustDialogState(plugin: Plugin, root: string): Promise<boolean | null> {
  if (plugin.kind !== 'local' || !plugin.def.trustDialogAccepted) return Promise.resolve(null);
  return plugin.def.trustDialogAccepted(root);
}

export const capabilitiesProbeKey = (root: string) => `capabilities:${root}`;
export const connectionsProbeKey = (root: string) => `connections:${root}`;

const FACT_TTL_MS = 10 * 60_000;

interface Fact {
  result: Promise<ProbeResult>;
  expiresAt: number;
}

const machineFacts = new Map<string, Fact>();
const repoFacts = new Map<string, Map<string, Fact>>();

const factKey = (command: string, args: string[]) => [command, ...args].join(' ');

function remembered(
  facts: Map<string, Fact>,
  key: string,
  load: () => Promise<ProbeResult>,
): Promise<ProbeResult> {
  const cached = facts.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const fact: Fact = { result: load(), expiresAt: Date.now() + FACT_TTL_MS };
  facts.set(key, fact);
  fact.result.then(({ timedOut }) => {
    if (timedOut && facts.get(key) === fact) facts.delete(key);
  });
  return fact.result;
}

function probeExec(root: string): ProbeExec {
  return {
    machine: (command, args, timeoutMs) =>
      remembered(machineFacts, factKey(command, args), () => run(command, args, root, timeoutMs)),
    repo: (command, args, timeoutMs) => {
      let facts = repoFacts.get(root);
      if (!facts) {
        facts = new Map();
        repoFacts.set(root, facts);
      }
      return remembered(facts, factKey(command, args), () => run(command, args, root, timeoutMs));
    },
  };
}

export function clearCapabilitiesCache(root: string): void {
  machineFacts.clear();
  repoFacts.delete(root);
  clearProbe(capabilitiesProbeKey(root));
  clearProbe(connectionsProbeKey(root));
}

export function clearAgentAuthStatusCache(): void {
  machineFacts.delete(factKey('claude', CLAUDE_AUTH_STATUS_ARGS));
}

export function probeCapabilities(root: string): Promise<CapabilityResult[]> {
  const exec = probeExec(root);
  return Promise.all(PLUGINS.map((p) => p.def.probe(exec)));
}

async function toConnectionResult(
  plugin: Plugin,
  root: string,
  precomputed?: CapabilityResult,
): Promise<ConnectionResult> {
  const exec = probeExec(root);
  const [result, authenticated, trustDialogAccepted] = await Promise.all([
    precomputed ?? plugin.def.probe(exec),
    authState(plugin, exec),
    trustDialogState(plugin, root),
  ]);
  return {
    id: plugin.def.id as ConnectionResult['id'],
    kind: plugin.kind,
    label: plugin.def.label,
    unlocks: plugin.def.unlocks,
    status: result.status,
    detail: result.detail,
    authenticated,
    trustDialogAccepted,
    connect: plugin.def.connect(result),
  };
}

export function probeConnections(root: string): Promise<ConnectionResult[]> {
  return Promise.all(PLUGINS.map((p) => toConnectionResult(p, root)));
}

/** Runs a plugin's connect action when it's safe to run non-interactively, then
 *  re-probes; a non-runnable action (interactive login, a command with placeholders,
 *  a link, or plain text) is left for the caller to display instead. */
export async function runConnect(id: string, root: string): Promise<ConnectionResult | null> {
  const plugin = PLUGINS.find((p) => p.def.id === id);
  if (!plugin) return null;
  const before = await plugin.def.probe(probeExec(root));
  const action = plugin.def.connect(before);
  if (action?.kind !== 'command' || !action.runnable) {
    return toConnectionResult(plugin, root, before);
  }
  // `runnable` commands are checked at their definition site to be argv-safe literals
  // (no placeholders, no shell operators), so splitting on spaces is sufficient here.
  const [command, ...args] = action.command.split(' ');
  const outcome = await run(command, args, root);
  clearCapabilitiesCache(root);
  const after = await toConnectionResult(plugin, root);
  return outcome.code === 0
    ? after
    : { ...after, detail: `${action.command} failed: ${outcome.stderr.trim() || after.detail}` };
}

const UNKNOWN_AUTH_STATUS: AgentAuthStatus = {
  loggedIn: null,
  authMethod: null,
  apiProvider: null,
};

// Only the claude-code adapter exposes an `auth status` subcommand; other agents
// report unknown rather than being probed with a command they don't have.
export async function probeAgentAuthStatus(id: AgentId, root: string): Promise<AgentAuthStatus> {
  if (id !== 'claude-code') return UNKNOWN_AUTH_STATUS;
  const status = await machineClaudeAuthStatus(probeExec(root));
  return status ?? UNKNOWN_AUTH_STATUS;
}
