import type { CiReleaseState } from '@/types/index';
import { apiFetch, apiUrl } from './api-base';

export const fetchCiRelease = async (): Promise<CiReleaseState | null> => {
  try {
    const response = await apiFetch(apiUrl('/api/ci'));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};
