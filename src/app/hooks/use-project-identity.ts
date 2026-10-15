import { packageNameQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchIconDataUri, fetchPackageName, projectDisplayName } from '@/app/services/system';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export interface ProjectIdentity {
  projectName: string | null;
  iconDataUri: string | null;
  nameLoading: boolean;
  iconLoading: boolean;
}

export const useProjectIdentity = (): ProjectIdentity => {
  const { runtimeUrl } = useRuntimeConnection();
  const { data: packageName, isLoading: nameLoading } = useQuery({
    queryKey: packageNameQueryKey(runtimeUrl),
    queryFn: fetchPackageName,
  });
  const [iconDataUri, setIconDataUri] = useState<string | null>(null);
  const [iconLoading, setIconLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIconLoading(true);

    fetchIconDataUri()
      .then((uri) => {
        if (!cancelled) setIconDataUri(uri);
      })
      .finally(() => {
        if (!cancelled) setIconLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    projectName: packageName ? projectDisplayName(packageName) : null,
    iconDataUri,
    nameLoading,
    iconLoading,
  };
};
