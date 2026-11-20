import { useEffect } from 'react';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { useAppStore } from '@/app/stores/app-store';

export function useProjectState(): void {
  const { runtimeUrl } = useRuntimeConnection();
  const refreshProjectState = useAppStore((state) => state.refreshProjectState);
  const loadGitLog = useAppStore((state) => state.loadGitLog);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a different runtime is the trigger to reload, not a value the body reads.
  useEffect(() => {
    refreshProjectState();
    loadGitLog();
  }, [runtimeUrl, refreshProjectState, loadGitLog]);
}
