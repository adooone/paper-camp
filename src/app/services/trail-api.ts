import type { ProvenanceTrail } from '@/types/index';

export const fetchTrail = async (id: string): Promise<ProvenanceTrail> => {
  const response = await fetch(`/api/trail?id=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error('Failed to load the provenance trail');
  return response.json();
};
