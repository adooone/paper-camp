import { fetchTrail } from '@/app/services/trail-api';
import type { ProvenanceTrail } from '@/types/index';
import { useEffect, useState } from 'react';

export const useTrail = (id: string | undefined): ProvenanceTrail | null => {
  const [trail, setTrail] = useState<ProvenanceTrail | null>(null);

  useEffect(() => {
    setTrail(null);
    if (!id) return;
    let cancelled = false;
    fetchTrail(id)
      .then((result) => {
        if (!cancelled) setTrail(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  return trail;
};
