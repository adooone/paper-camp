import { fetchConfig, saveConfig } from '@/app/services/system';
import { useEffect, useState } from 'react';

export interface ProjectSubjects {
  subjects: string[];
  loading: boolean;
  addSubject: (name: string) => Promise<boolean>;
  renameSubject: (from: string, to: string) => Promise<boolean>;
  removeSubject: (name: string) => Promise<boolean>;
}

export const useProjectSubjects = (): ProjectSubjects => {
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

  const persist = async (next: string[]) => {
    const ok = await saveConfig({ subjects: next });
    if (ok) setSubjects(next);
    return ok;
  };

  const addSubject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || subjects.includes(trimmed)) return Promise.resolve(false);
    return persist([...subjects, trimmed]);
  };

  const renameSubject = (from: string, to: string) => {
    const trimmed = to.trim();
    if (!trimmed || (trimmed !== from && subjects.includes(trimmed))) return Promise.resolve(false);
    return persist(subjects.map((s) => (s === from ? trimmed : s)));
  };

  const removeSubject = (name: string) => persist(subjects.filter((s) => s !== name));

  return { subjects, loading, addSubject, renameSubject, removeSubject };
};
