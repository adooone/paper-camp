import type { AgentAuthStatus, AgentId, CapabilityResult, ConnectionResult } from '../../types';
import { SERVICES, type ServiceDefinition, claudeAuthStatus, run } from './services';

export async function probeCapabilities(root: string): Promise<CapabilityResult[]> {
  return Promise.all(SERVICES.map((service) => service.probe(root)));
}

async function toConnectionResult(
  service: ServiceDefinition,
  root: string,
  precomputed?: CapabilityResult,
): Promise<ConnectionResult> {
  const [result, authenticated] = await Promise.all([
    precomputed ?? service.probe(root),
    service.authenticated(root),
  ]);
  return {
    id: service.id as ConnectionResult['id'],
    label: service.label,
    unlocks: service.unlocks,
    status: result.status,
    detail: result.detail,
    authenticated,
    connect: service.connect(result),
  };
}

export async function probeConnections(root: string): Promise<ConnectionResult[]> {
  return Promise.all(SERVICES.map((service) => toConnectionResult(service, root)));
}

/** Runs a service's connect action when it's safe to run non-interactively, then
 *  re-probes; a non-runnable action (interactive login, a command with placeholders,
 *  a link, or plain text) is left for the caller to display instead. */
export async function runConnect(id: string, root: string): Promise<ConnectionResult | null> {
  const service = SERVICES.find((s) => s.id === id);
  if (!service) return null;
  const before = await service.probe(root);
  const action = service.connect(before);
  if (action?.kind !== 'command' || !action.runnable) {
    return toConnectionResult(service, root, before);
  }
  // `runnable` commands are checked at their definition site to be argv-safe literals
  // (no placeholders, no shell operators), so splitting on spaces is sufficient here.
  const [command, ...args] = action.command.split(' ');
  const outcome = await run(command, args, root);
  const after = await toConnectionResult(service, root);
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
  const status = await claudeAuthStatus(root);
  return status ?? UNKNOWN_AUTH_STATUS;
}
