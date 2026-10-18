import type { CiReleaseState } from '@/types/index';
import { apiFetch, apiUrl } from './api-base';

export const fetchCiRelease = async (fresh = false): Promise<CiReleaseState | null> => {
  try {
    const response = await apiFetch(apiUrl(fresh ? '/api/ci?fresh=1' : '/api/ci'));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};
