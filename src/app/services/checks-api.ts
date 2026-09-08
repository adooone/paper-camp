import type { DeskCheckState } from '@/types/index';
import { apiFetch, apiUrl } from './api-base';

export const fetchChecks = async (): Promise<DeskCheckState[]> => {
  const response = await apiFetch(apiUrl('/api/checks'));
  if (!response.ok) return [];
  const body = (await response.json()) as { checks?: DeskCheckState[] };
  return body.checks ?? [];
};

export const runDeskCheck = async (name: string): Promise<void> => {
  const response = await apiFetch(apiUrl(`/api/checks/run?name=${encodeURIComponent(name)}`), {
    method: 'POST',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to run check' }));
    throw new Error(err.error ?? 'Failed to run check');
  }
};

export const runChangedCheck = async (name: string): Promise<void> => {
  const response = await apiFetch(apiUrl(`/api/checks/changed?name=${encodeURIComponent(name)}`), {
    method: 'POST',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to run changed check' }));
    throw new Error(err.error ?? 'Failed to run changed check');
  }
};

export const fixDeskCheck = async (name: string): Promise<DeskCheckState> => {
  const response = await apiFetch(apiUrl('/api/checks/fix'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to fix check' }));
    throw new Error(err.error ?? 'Failed to fix check');
  }
  const body = (await response.json()) as { check: DeskCheckState };
  return body.check;
};
