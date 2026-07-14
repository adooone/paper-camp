import { fetchIconDataUri, fetchPackageName } from '@/app/services/system';
import { useEffect, useState } from 'react';

const kebabToTitle = (s: string) =>
  s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export interface ProjectIdentity {
  projectName: string | null;
  iconDataUri: string | null;
  loading: boolean;
}

export const useProjectIdentity = (): ProjectIdentity => {
  const [projectName, setProjectName] = useState<string | null>(null);
  const [iconDataUri, setIconDataUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchPackageName().then((name) => {
        if (!cancelled && name) setProjectName(kebabToTitle(name));
      }),
      fetchIconDataUri().then((uri) => {
        if (!cancelled) setIconDataUri(uri);
      }),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { projectName, iconDataUri, loading };
};
