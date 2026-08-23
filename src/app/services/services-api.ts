import type { ServiceState } from '@/types/index';
import { apiFetch, apiUrl } from './api-base';

const handleResponse = async (response: Response, fallback: string): Promise<void> => {
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: fallback }));
    throw new Error(err.error ?? fallback);
  }
};

export const fetchServices = async (): Promise<ServiceState[]> => {
  const response = await apiFetch(apiUrl('/api/services'));
  if (!response.ok) return [];
  const body = (await response.json()) as { services?: ServiceState[] };
  return body.services ?? [];
};

export const startService = async (name: string): Promise<void> => {
  const response = await apiFetch(apiUrl(`/api/services/start?name=${encodeURIComponent(name)}`), {
    method: 'POST',
  });
  await handleResponse(response, 'Failed to start service');
};

export const stopService = async (name: string): Promise<void> => {
  const response = await apiFetch(apiUrl(`/api/services/stop?name=${encodeURIComponent(name)}`), {
    method: 'POST',
  });
  await handleResponse(response, 'Failed to stop service');
};

export const fetchServiceLog = async (name: string): Promise<string> => {
  const response = await apiFetch(apiUrl(`/api/services/logs?name=${encodeURIComponent(name)}`));
  if (!response.ok) return '';
  const body = (await response.json()) as { log?: string };
  return body.log ?? '';
};
