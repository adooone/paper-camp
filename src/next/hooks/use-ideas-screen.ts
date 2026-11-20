import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useWorklist } from '@/app/hooks/use-worklist';
import { worklistQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { PlanStatus, WorklistEntry } from '@/types/index';
import {
  type IdeaGroup,
  ideaGroups,
  isFoldable,
  tabCounts,
  type WorkTab,
} from '../shell/ideas-model';
import { useProjectName } from './use-project-name';

export type IdeasLoad = 'loading' | 'unreachable' | 'ready';

export interface IdeasScreenState {
  projectName: string | null;
  load: IdeasLoad;
  entries: WorklistEntry[];
  groups: IdeaGroup[];
  counts: Record<WorkTab, number> | null;
  tab: WorkTab;
  selectTab: (tab: WorkTab) => void;
  isOpen: (status: PlanStatus) => boolean;
  toggle: (status: PlanStatus) => void;
  retry: () => void;
}

export function useIdeasScreen(): IdeasScreenState {
  const projectName = useProjectName();
  const { runtimeUrl } = useRuntimeConnection();
  const queryClient = useQueryClient();
  const { worklist, worklistError } = useWorklist();
  const [tab, setTab] = useState<WorkTab>('todo');
  const [expanded, setExpanded] = useState<Partial<Record<PlanStatus, boolean>>>({});

  const load: IdeasLoad = worklist ? 'ready' : worklistError ? 'unreachable' : 'loading';
  const entries = useMemo(() => worklist ?? [], [worklist]);
  const groups = useMemo(() => ideaGroups(entries, tab), [entries, tab]);
  const counts = useMemo(() => (worklist ? tabCounts(worklist) : null), [worklist]);

  const toggle = useCallback(
    (status: PlanStatus) => setExpanded((value) => ({ ...value, [status]: !value[status] })),
    [],
  );
  const isOpen = useCallback(
    (status: PlanStatus) => !isFoldable(status) || Boolean(expanded[status]),
    [expanded],
  );
  const retry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: worklistQueryKey(runtimeUrl) });
  }, [queryClient, runtimeUrl]);

  return {
    projectName,
    load,
    entries,
    groups,
    counts,
    tab,
    selectTab: setTab,
    isOpen,
    toggle,
    retry,
  };
}
