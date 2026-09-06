import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import {
  applyPromotions,
  collectAgentRunIssues,
  collectCheckIssues,
  collectPrReviewIssues,
} from '@/core/issues';
import { buildLogRows } from '@/core/log-rows';
import type { PlanEntry } from '@/types/index';
import { useEffect, useMemo, useState } from 'react';
import { LOG_PAGE_SIZE } from '../constants';

export const useLogPage = () => {
  const taskLog = useAppStore((s) => s.taskLog);
  const taskLogLoading = useAppStore((s) => s.taskLogLoading);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const plans = useAppStore((s) => s.plans);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const { checks } = useDeskChecks();
  const [visibleCount, setVisibleCount] = useState(LOG_PAGE_SIZE);

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const entities = useMemo(() => {
    const planEntities = (plans?.entries ?? []).filter(
      (p): p is PlanEntry & { id: string } => p.id != null,
    );
    return [...planEntities, ...ideaEntries].filter(
      (entity): entity is typeof entity & { id: string } => entity.id != null,
    );
  }, [plans, ideaEntries]);

  const rows = useMemo(() => {
    const issues = applyPromotions(
      [
        ...collectAgentRunIssues(taskLog),
        ...collectCheckIssues(checks),
        ...collectPrReviewIssues(entities),
      ],
      entities,
    );
    return buildLogRows(taskLog, issues, agentStatus);
  }, [taskLog, checks, entities, agentStatus]);

  const visibleRows = rows.slice(0, visibleCount);

  return {
    loading: taskLogLoading,
    rows: visibleRows,
    hasMore: rows.length > visibleRows.length,
    loadMore: () => setVisibleCount((n) => n + LOG_PAGE_SIZE),
  };
};
