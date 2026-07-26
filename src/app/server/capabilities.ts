import type { AgentAuthStatus, AgentId, CapabilityResult, ConnectionResult } from '../../types';
import { SERVICES, claudeAuthStatus } from './services';

export async function probeCapabilities(root: string): Promise<CapabilityResult[]> {
  return Promise.all(SERVICES.map((service) => service.probe(root)));
}

export async function probeConnections(root: string): Promise<ConnectionResult[]> {
  return Promise.all(
    SERVICES.map(async (service) => {
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
      };
    }),
  );
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
