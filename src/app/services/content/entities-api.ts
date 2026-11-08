import type {
  AgentId,
  EntityDetailEntry,
  EntityType,
  LogEntry,
  ParseResult,
  PhaseItem,
  PlanEntry,
  PlanStatus,
  ThreadMessage,
  WorklistEntry,
} from '@/types/index';
import { apiFetch, apiUrl } from '../api-base';

const PLANS_TIMEOUT_MS = 45_000;

export const fetchPlans = async (): Promise<ParseResult<PlanEntry>> => {
  const response = await apiFetch(apiUrl('/api/plans'), {
    signal: AbortSignal.timeout(PLANS_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load plans (${response.status})`);
  }
  return response.json();
};

// The registry holds runtimes this client is not currently pointed at, so the base
// URL is explicit rather than taken from `apiUrl` — mirrors `fetchPackageNameAt`.
export const fetchPlansAt = async (baseUrl: string): Promise<ParseResult<PlanEntry> | null> => {
  try {
    const response = await fetch(`${baseUrl}/api/plans`, {
      signal: AbortSignal.timeout(PLANS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export const fetchWorklist = async (): Promise<WorklistEntry[]> => {
  const response = await apiFetch(apiUrl('/api/worklist'), {
    signal: AbortSignal.timeout(PLANS_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load the worklist (${response.status})`);
  }
  return response.json();
};

export const fetchWorklistAt = async (baseUrl: string): Promise<WorklistEntry[]> => {
  const response = await fetch(`${baseUrl}/api/worklist`, {
    signal: AbortSignal.timeout(PLANS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Failed to load the worklist (${response.status})`);
  return response.json();
};

export const fetchEntity = async (id: string): Promise<EntityDetailEntry> => {
  const response = await apiFetch(apiUrl(`/api/entities?id=${encodeURIComponent(id)}`), {
    signal: AbortSignal.timeout(PLANS_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load ${id} (${response.status})`);
  }
  return response.json();
};

export const patchEntity = async (
  id: string,
  updates: {
    title?: string;
    body?: string;
    tags?: string[];
    type?: EntityType;
    needs?: string[];
    phases?: PhaseItem[];
    fixes?: PhaseItem[];
    /** `null` clears the stored status override (e.g. reopening a dropped plan). */
    status?: PlanStatus | null;
    log?: LogEntry[];
    thread?: ThreadMessage[];
    agent?: AgentId | null;
    /** `null` clears the frontmatter key, rendering the idea under "No subject". */
    subject?: string | null;
    /** `null` clears the frontmatter key, so the row falls back to unordered. */
    order?: number | null;
  },
): Promise<void> => {
  const response = await fetch(apiUrl(`/api/entities?id=${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  // Surface server rejections (e.g. the 409 branch-conflict guard on done/dropped)
  // instead of resolving silently, so callers can toast the reason.
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Failed to update entity (${response.status})`);
  }
};
