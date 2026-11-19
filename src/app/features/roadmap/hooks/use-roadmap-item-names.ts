import { useEffect, useState } from 'react';
import { fetchRoadmap } from '@/app/services/content/docs-api';

export const useRoadmapItemNames = (): Set<string> => {
  const [names, setNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchRoadmap()
      .then((roadmap) => {
        if (cancelled || !roadmap) return;
        setNames(new Set(roadmap.horizons.flatMap((h) => h.items.map((item) => item.name))));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return names;
};
