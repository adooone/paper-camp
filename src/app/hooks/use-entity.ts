import { fetchEntity } from '@/app/services/content';
import { entityQueryKey, worklistQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { EntityDetailEntry, WorklistEntry } from '@/types/index';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const rowAsEntity = (row: WorklistEntry): EntityDetailEntry => ({
  id: row.id,
  title: row.title,
  type: row.type,
  kind: row.kind,
  status: row.status,
  idea: row.parent,
  created: row.created,
  updated: row.updated,
  tags: row.tags,
  needs: row.needs,
  subject: row.subject,
  order: row.order,
  archived: row.archived,
  body: '',
  phases: [],
});

export function useEntity(id: string | null | undefined) {
  const { runtimeUrl } = useRuntimeConnection();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: entityQueryKey(runtimeUrl, id ?? ''),
    queryFn: () => fetchEntity(id as string),
    enabled: Boolean(id),
    placeholderData: () => {
      const row = queryClient
        .getQueryData<WorklistEntry[]>(worklistQueryKey(runtimeUrl))
        ?.find((entry) => entry.id === id);
      return row ? rowAsEntity(row) : undefined;
    },
  });
}
