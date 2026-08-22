import type {
  AgentId,
  LogEntry,
  ParseResult,
  PhaseItem,
  PlanEntry,
  PlanStatus,
  ThreadMessage,
} from '@/types/index';
import { apiUrl } from '../api-base';

const PLANS_TIMEOUT_MS = 45_000;

export const fetchPlans = async (): Promise<ParseResult<PlanEntry>> => {
  const response = await fetch(apiUrl('/api/plans'), {
    signal: AbortSignal.timeout(PLANS_TIMEOUT_MS),
  });
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

export const updatePlan = async (
  title: string,
  updates: {
    body?: string;
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
  const response = await fetch(apiUrl(`/api/plans?title=${encodeURIComponent(title)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  // Surface server rejections (e.g. the 409 branch-conflict guard on done/dropped)
  // instead of resolving silently, so callers can toast the reason.
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Failed to update plan (${response.status})`);
  }
};
