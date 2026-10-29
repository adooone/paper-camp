import {
  type AgentAuthStatus,
  type AgentTaskState,
  type CapabilityResult,
  type ConnectionResult,
  MACHINE_BATCH_PATH,
  MACHINE_NIGHT_PATH,
  MACHINE_PROJECTS_PATH,
  type MachineBatchResponse,
  type MachineNightGateResponse,
  type MachineProjectsResponse,
  PAIRING_TOKEN_HEADER,
} from '@/types/index';
import { apiUrl } from '../api-base';
import { machineToken } from '../machine-store';

export interface CapabilitiesPayload {
  capabilities: CapabilityResult[];
  version: string | null;
}

export const fetchCapabilitiesPayload = async (): Promise<CapabilitiesPayload | null> => {
  const response = await fetch(apiUrl('/api/capabilities'));
  if (!response.ok) return null;
  const body = (await response.json()) as { capabilities: CapabilityResult[]; version?: string };
  return { capabilities: body.capabilities, version: body.version ?? null };
};

export const fetchCapabilities = async (): Promise<CapabilityResult[] | null> =>
  (await fetchCapabilitiesPayload())?.capabilities ?? null;

/**
 * The registry holds runtimes this client is not currently pointed at, so
 * the base URL is explicit rather than taken from `apiUrl`. A response at
 * all, regardless of the version it carries, is this hub's signal that the
 * runtime is reachable.
 */
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

/**
 * The registry holds runtimes this client is not currently pointed at, so
 * the base URL is explicit rather than taken from `apiUrl` — same shape as
 * `fetchRuntimeVersionAt` above, asking a specific runtime whether it has a
 * task in flight rather than this client's own.
 */
export const fetchAgentStatusAt = async (baseUrl: string): Promise<AgentTaskState[] | null> => {
  try {
    const response = await fetch(`${baseUrl}/api/agent/status`);
    if (!response.ok) return null;
    return (await response.json()) as AgentTaskState[];
  } catch {
    return null;
  }
};

export const fetchAgentAuthStatus = async (): Promise<AgentAuthStatus | null> => {
  const response = await fetch(apiUrl('/api/agent/auth-status'));
  if (!response.ok) return null;
  return (await response.json()) as AgentAuthStatus;
};

export const fetchConnections = async (recheck = false): Promise<ConnectionResult[] | null> => {
  try {
    const response = await fetch(apiUrl(`/api/connections${recheck ? '?recheck=1' : ''}`));
    if (!response.ok) return null;
    const body = (await response.json()) as { connections: ConnectionResult[] };
    return body.connections;
  } catch {
    return null;
  }
};

/**
 * The registry holds machines this client is not currently pointed at, so the
 * base URL is explicit rather than taken from `apiUrl` — same shape as
 * `fetchRuntimeVersionAt` above, one level up (a machine, not a single project).
 * `pendingUpdateVersion` defaults to `null` for an older daemon that predates
 * this field, rather than dropping the whole response over one missing key.
 */
export const fetchMachineProjects = async (
  machineUrl: string,
): Promise<MachineProjectsResponse | null> => {
  try {
    const response = await fetch(`${machineUrl}${MACHINE_PROJECTS_PATH}`);
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<MachineProjectsResponse>;
    return {
      projects: body.projects ?? [],
      pendingUpdateVersion: body.pendingUpdateVersion ?? null,
    };
  } catch {
    return null;
  }
};

/**
 * The registry holds machines this client is not currently pointed at, so the
 * base URL is explicit rather than taken from `apiUrl` — same shape as
 * `fetchMachineProjects` above, one endpoint over for the night-shift gate.
 */
export const fetchMachineNightGate = async (
  machineUrl: string,
): Promise<MachineNightGateResponse | null> => {
  try {
    const response = await fetch(`${machineUrl}${MACHINE_NIGHT_PATH}`);
    if (!response.ok) return null;
    return (await response.json()) as MachineNightGateResponse;
  } catch {
    return null;
  }
};

/**
 * Mutating, unlike `fetchMachineProjects`/`fetchMachineNightGate` above, so it
 * needs this machine's own pairing token (not the current project's, which
 * `apiUrl`'s fetch wrapper carries) — stored the first time a project on it was
 * opened, by `open-project.ts`'s pairing handshake.
 */
export const startMachineBatch = async (
  machineUrl: string,
  slugs: string[],
): Promise<MachineBatchResponse> => {
  try {
    const token = machineToken(machineUrl);
    const response = await fetch(`${machineUrl}${MACHINE_BATCH_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token && { [PAIRING_TOKEN_HEADER]: token }),
      },
      body: JSON.stringify({ slugs }),
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: body?.error ?? `Request failed (${response.status})` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
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
