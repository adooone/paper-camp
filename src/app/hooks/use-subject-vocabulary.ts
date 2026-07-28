import { fetchConfig } from '@/app/services/system';
import { useEffect, useState } from 'react';

export interface SubjectVocabulary {
  subjects: string[];
  loading: boolean;
}

// Read-only: `subjects` is derived from ROADMAP.md server-side (IDEA-95), so there's
// nothing here to add/rename/remove — edit the vocabulary via the Roadmap page.
export const useSubjectVocabulary = (): SubjectVocabulary => {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchConfig().then((config) => {
      if (!cancelled) {
        setSubjects(config?.subjects ?? []);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { subjects, loading };
};
