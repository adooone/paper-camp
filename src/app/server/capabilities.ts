import type { AgentAuthStatus, AgentId, CapabilityResult, ConnectionResult } from '../../types';
import { SERVICES, type ServiceDefinition, claudeAuthStatus, run } from './services';

export async function probeCapabilities(root: string): Promise<CapabilityResult[]> {
  return Promise.all(SERVICES.map((service) => service.probe(root)));
}

async function toConnectionResult(
  service: ServiceDefinition,
  root: string,
): Promise<ConnectionResult> {
  const [result, authenticated] = await Promise.all([
    service.probe(root),
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
  if (action?.kind === 'command' && action.runnable) {
    await run('sh', ['-c', action.command], root);
  }
  return toConnectionResult(service, root);
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
