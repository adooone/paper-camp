import type {
  AgentId,
  LogEntry,
  ParseResult,
  PhaseItem,
  PlanEntry,
  PlanStatus,
} from '@/types/index';

export const fetchPlans = async (): Promise<ParseResult<PlanEntry>> => {
  const response = await fetch('/api/plans');
  return response.json();
};

export const createPlan = async (idea: {
  title: string;
  content?: string;
  kind?: string;
}): Promise<void> => {
  await fetch('/api/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idea),
  });
};

export const updatePlan = async (
  title: string,
  updates: {
    body?: string;
    phases?: PhaseItem[];
    /** `null` clears the stored status override (e.g. reopening a dropped plan). */
    status?: PlanStatus | null;
    log?: LogEntry[];
    agent?: AgentId | null;
    /** `null` clears the frontmatter key, rendering the idea under "No subject". */
    subject?: string | null;
    /** `null` clears the frontmatter key, so the row falls back to unordered. */
    order?: number | null;
  },
): Promise<void> => {
  const response = await fetch(`/api/plans?title=${encodeURIComponent(title)}`, {
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
