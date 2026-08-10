import type { CiReleaseState } from '@/types/index';
import { apiUrl } from './api-base';

export const fetchCiRelease = async (): Promise<CiReleaseState | null> => {
  try {
    const response = await fetch(apiUrl('/api/ci'));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};
