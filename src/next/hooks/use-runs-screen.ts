import { useMemo, useState } from 'react';
import { resolveLogRow } from '@/core/run-rows';
import type { LogRow, LogRowOutcome, LogRowType } from '@/types/index';
import {
  applyFilters,
  EMPTY_FILTERS,
  type LogFilterState,
  splitRows,
  toggled,
} from '../shell/run-model';
import { useAgentStatusStream } from './use-agent-status-stream';
import { useLogSnapshot } from './use-runs-snapshot';

export interface LogScreenState {
  load: 'loading' | 'unreachable' | 'ready';
  total: number;
  waiting: LogRow[];
  feed: LogRow[];
  filters: LogFilterState;
  toggleOutcome: (id: LogRowOutcome) => void;
  toggleType: (id: LogRowType) => void;
  find: (entryId: string) => LogRow | undefined;
  reload: () => Promise<void>;
}

export function useLogScreen(): LogScreenState {
  useAgentStatusStream();
  const { loading, failed, rows, reload } = useLogSnapshot();
  const [filters, setFilters] = useState<LogFilterState>(EMPTY_FILTERS);
  return useMemo(() => {
    const { waiting, feed } = splitRows(applyFilters(rows, filters));
    return {
      load: rows.length > 0 ? 'ready' : loading ? 'loading' : failed ? 'unreachable' : 'ready',
      total: rows.length,
      waiting,
      feed,
      filters,
      toggleOutcome: (id) =>
        setFilters((current) => ({ ...current, outcomes: toggled(current.outcomes, id) })),
      toggleType: (id) =>
        setFilters((current) => ({ ...current, types: toggled(current.types, id) })),
      find: (entryId) => resolveLogRow(rows, entryId),
      reload,
    };
  }, [rows, loading, failed, filters, reload]);
}
