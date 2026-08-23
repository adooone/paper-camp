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
