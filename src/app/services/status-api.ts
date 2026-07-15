import type { CheckName, CheckResult } from '@/types/index';

export interface StatusState {
  lint: CheckResult;
  format: CheckResult;
  test: CheckResult;
  consistency: CheckResult;
}

export const fetchStatus = async (): Promise<StatusState> => {
  const response = await fetch('/api/status');
  return response.json();
};

export const triggerCheck = async (name: CheckName): Promise<void> => {
  await fetch(`/api/status/check?name=${name}`, { method: 'POST' });
};

export const triggerQualityFix = async (): Promise<void> => {
  await fetch('/api/status/fix', { method: 'POST' });
};

// Drops the server's resolved-PR cache so the reads that follow re-fetch review
// state from `gh` rather than replaying the cache window.
export const dropServerCaches = async (): Promise<void> => {
  const response = await fetch('/api/refresh', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to drop caches: ${response.statusText}`);
  }
};
