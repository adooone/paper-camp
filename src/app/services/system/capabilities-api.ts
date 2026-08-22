import type { AgentAuthStatus, CapabilityResult, ConnectionResult } from '@/types/index';
import { apiUrl } from '../api-base';

export const fetchCapabilities = async (): Promise<CapabilityResult[] | null> => {
  const response = await fetch(apiUrl('/api/capabilities'));
  if (!response.ok) return null;
  const body = (await response.json()) as { capabilities: CapabilityResult[] };
  return body.capabilities;
};

// The registry holds runtimes this client is not currently pointed at, so the base
// URL is explicit rather than taken from `apiUrl` — mirrors `fetchPackageNameAt`. A
// response at all, regardless of the version it carries, is this hub's signal that
// the runtime is reachable.
export const fetchRuntimeVersionAt = async (baseUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(`${baseUrl}/api/capabilities`);
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: string };
    return body.version ?? null;
  } catch {
    return null;
  }
};

export const fetchAgentAuthStatus = async (): Promise<AgentAuthStatus | null> => {
  const response = await fetch(apiUrl('/api/agent/auth-status'));
  if (!response.ok) return null;
  return (await response.json()) as AgentAuthStatus;
};

export const fetchConnections = async (): Promise<ConnectionResult[] | null> => {
  try {
    const response = await fetch(apiUrl('/api/connections'));
    if (!response.ok) return null;
    const body = (await response.json()) as { connections: ConnectionResult[] };
    return body.connections;
  } catch {
    return null;
  }
};

export const connectService = async (id: string): Promise<ConnectionResult | null> => {
  try {
    const response = await fetch(apiUrl(`/api/connections/connect?id=${encodeURIComponent(id)}`), {
      method: 'POST',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { connection: ConnectionResult };
    return body.connection;
  } catch {
    return null;
  }
};
