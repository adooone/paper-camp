import type { AgentAuthStatus, AgentId, CapabilityResult } from '../../types';
import { SERVICES, run } from './services';

export async function probeCapabilities(root: string): Promise<CapabilityResult[]> {
  return Promise.all(SERVICES.map((service) => service.probe(root)));
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
  const result = await run('claude', ['auth', 'status'], root);
  if (result.code !== 0) return UNKNOWN_AUTH_STATUS;
  try {
    const parsed = JSON.parse(result.stdout) as Partial<AgentAuthStatus>;
    return {
      loggedIn: typeof parsed.loggedIn === 'boolean' ? parsed.loggedIn : null,
      authMethod: typeof parsed.authMethod === 'string' ? parsed.authMethod : null,
      apiProvider: typeof parsed.apiProvider === 'string' ? parsed.apiProvider : null,
    };
  } catch {
    return UNKNOWN_AUTH_STATUS;
  }
}
