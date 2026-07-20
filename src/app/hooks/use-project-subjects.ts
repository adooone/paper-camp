import { fetchConfig, saveConfig } from '@/app/services/system';
import { useEffect, useRef, useState } from 'react';

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
  const subjectsRef = useRef<string[]>([]);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    fetchConfig().then((config) => {
      if (!cancelled) {
        const loaded = config?.subjects ?? [];
        subjectsRef.current = loaded;
        setSubjects(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Chains each mutation off the latest committed state so a slow save can't be
  // clobbered by a faster one racing ahead of it.
  const enqueue = (mutate: (current: string[]) => string[] | false): Promise<boolean> => {
    const run = queueRef.current.then(async () => {
      const next = mutate(subjectsRef.current);
      if (next === false) return false;
      const { ok } = await saveConfig({ subjects: next });
      if (ok) {
        subjectsRef.current = next;
        setSubjects(next);
      }
      return ok;
    });
    queueRef.current = run;
    return run;
  };

  const addSubject = (name: string) =>
    enqueue((current) => {
      const trimmed = name.trim();
      if (!trimmed || current.includes(trimmed)) return false;
      return [...current, trimmed];
    });

  const renameSubject = (from: string, to: string) =>
    enqueue((current) => {
      const trimmed = to.trim();
      if (!trimmed || (trimmed !== from && current.includes(trimmed))) return false;
      return current.map((s) => (s === from ? trimmed : s));
    });

  const removeSubject = (name: string) => enqueue((current) => current.filter((s) => s !== name));

  return { subjects, loading, addSubject, renameSubject, removeSubject };
};
