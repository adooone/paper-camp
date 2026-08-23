import type { ProvenanceTrail } from '@/types/index';
import { apiFetch, apiUrl } from './api-base';

export const fetchTrail = async (id: string): Promise<ProvenanceTrail> => {
  const response = await apiFetch(apiUrl(`/api/trail?id=${encodeURIComponent(id)}`));
  if (!response.ok) throw new Error('Failed to load the provenance trail');
  return response.json();
};
