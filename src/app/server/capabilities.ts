import type { AgentAuthStatus, AgentId, CapabilityResult, ConnectionResult } from '../../types';
import { EXTERNAL_SERVICES, type ExternalServiceDefinition } from './external-services';
import {
  LOCAL_ADAPTERS,
  type LocalAdapterDefinition,
  cachedClaudeAuthStatus,
  clearClaudeAuthStatusCache,
} from './local-adapters';
import { run } from './run';

const PROBE_TTL_MS = 60_000;

export type { ProbeResult } from './run';
export { run } from './run';

type Plugin =
  | { kind: 'external'; def: ExternalServiceDefinition }
  | { kind: 'local'; def: LocalAdapterDefinition };

const PLUGINS: Plugin[] = [
  ...EXTERNAL_SERVICES.map((def) => ({ kind: 'external' as const, def })),
  ...LOCAL_ADAPTERS.map((def) => ({ kind: 'local' as const, def })),
];

// The one place the two credential stores meet: external services report remote-account
// auth, local adapters local-session sign-in — different things, same client rendering.
function authState(plugin: Plugin, root: string): Promise<boolean | null> {
  return plugin.kind === 'external' ? plugin.def.authenticated(root) : plugin.def.signedIn(root);
}

// null for anything but claude-code, which is the only adapter with a trust dialog to check.
function trustDialogState(plugin: Plugin, root: string): Promise<boolean | null> {
  if (plugin.kind !== 'local' || !plugin.def.trustDialogAccepted) return Promise.resolve(null);
  return plugin.def.trustDialogAccepted(root);
}

interface TtlEntry<T> {
  value: Promise<T>;
  expiresAt: number;
}

const capabilitiesCache = new Map<string, TtlEntry<CapabilityResult[]>>();
const connectionsCache = new Map<string, TtlEntry<ConnectionResult[]>>();

// A daemon holds one middleware (and root) per mounted project in the same process,
// so every cache below is keyed by root rather than shared process-wide.
export function clearCapabilitiesCache(root: string): void {
  capabilitiesCache.delete(root);
  connectionsCache.delete(root);
}

export function clearAgentAuthStatusCache(root: string): void {
  clearClaudeAuthStatusCache(root);
}

export async function probeCapabilities(root: string): Promise<CapabilityResult[]> {
  const cached = capabilitiesCache.get(root);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = Promise.all(PLUGINS.map((p) => p.def.probe(root)));
  capabilitiesCache.set(root, { value, expiresAt: Date.now() + PROBE_TTL_MS });
  return value;
}

async function toConnectionResult(
  plugin: Plugin,
  root: string,
  precomputed?: CapabilityResult,
): Promise<ConnectionResult> {
  const [result, authenticated, trustDialogAccepted] = await Promise.all([
    precomputed ?? plugin.def.probe(root),
    authState(plugin, root),
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

export async function probeConnections(root: string): Promise<ConnectionResult[]> {
  const cached = connectionsCache.get(root);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = Promise.all(PLUGINS.map((p) => toConnectionResult(p, root)));
  connectionsCache.set(root, { value, expiresAt: Date.now() + PROBE_TTL_MS });
  return value;
}

/** Runs a plugin's connect action when it's safe to run non-interactively, then
 *  re-probes; a non-runnable action (interactive login, a command with placeholders,
 *  a link, or plain text) is left for the caller to display instead. */
export async function runConnect(id: string, root: string): Promise<ConnectionResult | null> {
  const plugin = PLUGINS.find((p) => p.def.id === id);
  if (!plugin) return null;
  const before = await plugin.def.probe(root);
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
  const status = await cachedClaudeAuthStatus(root);
  return status ?? UNKNOWN_AUTH_STATUS;
}
