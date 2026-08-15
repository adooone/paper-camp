import type { CheckResult } from '@/types/index';
import { apiUrl } from './api-base';

export interface StatusState {
  // The commit gate's own check — not a desk check, so it isn't sourced from
  // `desk.checks` (IDEA-162). Quality/Tests/Build come from `/api/checks` instead.
  consistency: CheckResult;
}

export const fetchStatus = async (): Promise<StatusState> => {
  const response = await fetch(apiUrl('/api/status'));
  return response.json();
};

export const triggerConsistencyCheck = async (): Promise<void> => {
  await fetch(apiUrl('/api/status/check?name=consistency'), { method: 'POST' });
};

// Drops the server's resolved-PR cache so the reads that follow re-fetch review
// state from `gh` rather than replaying the cache window.
export const dropServerCaches = async (): Promise<void> => {
  const response = await fetch(apiUrl('/api/refresh'), { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to drop caches: ${response.statusText}`);
  }
};
