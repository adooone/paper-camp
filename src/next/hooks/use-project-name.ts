import { useQuery } from '@tanstack/react-query';
import { packageNameQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchPackageName } from '@/app/services/system';
import { projectName } from '../shell/project-items';

export function useProjectName(): string | null {
  const { runtimeUrl } = useRuntimeConnection();
  const { data } = useQuery({
    queryKey: packageNameQueryKey(runtimeUrl),
    queryFn: fetchPackageName,
  });
  return data ? projectName(data) : null;
}
