import { configQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchConfigAt } from '@/app/services/system';
import { useQuery } from '@tanstack/react-query';

export interface SubjectVocabulary {
  subjects: string[];
  loading: boolean;
  available: boolean;
}

const NO_SUBJECTS: string[] = [];

export const useSubjectVocabulary = (): SubjectVocabulary => {
  const { runtimeUrl } = useRuntimeConnection();
  const { data, isPending, isError } = useQuery({
    queryKey: configQueryKey(runtimeUrl),
    queryFn: () => fetchConfigAt(runtimeUrl),
  });
  return {
    subjects: data?.subjects ?? NO_SUBJECTS,
    loading: isPending,
    available: !isError,
  };
};
