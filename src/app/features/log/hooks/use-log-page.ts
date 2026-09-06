import { useOpenEntity } from '@/app/hooks';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { promoteIssue } from '@/app/services/agent-api';
import { useAppStore } from '@/app/stores/app-store';
import {
  applyPromotions,
  collectAgentRunIssues,
  collectCheckIssues,
  collectPrReviewIssues,
  issueThreadFromTaskLog,
} from '@/core/issues';
import {
  type LogFilters,
  filterLogRows,
  parseLogFilters,
  serializeLogFilters,
} from '@/core/log-filters';
import { buildLogRows } from '@/core/log-rows';
import { computeLogStats } from '@/core/log-stats';
import type { Issue, LogRowType, PlanEntry, TaskLogEntry } from '@/types/index';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { LOG_PAGE_SIZE } from '../constants';

export interface ResolvedFailure extends Issue {
  cleared: boolean;
}

export interface LogRowActions {
  entities: { id: string; title: string }[];
  openEntity: (id: string | null | undefined, title: string) => void;
  resolveFailure: (entry: TaskLogEntry) => ResolvedFailure | undefined;
  launchIssueFix: (
    issueId: string,
    title: string,
    reason: string,
    output: string | undefined,
  ) => Promise<void>;
  fixingIssueId: string | undefined;
  promotingId: string | null;
  handlePromote: (issue: Issue) => Promise<void>;
}

export const useLogPage = () => {
  const taskLog = useAppStore((s) => s.taskLog);
  const taskLogLoading = useAppStore((s) => s.taskLogLoading);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const plans = useAppStore((s) => s.plans);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const launchIssueFix = useAppStore((s) => s.launchIssueFix);
  const { checks } = useDeskChecks();
  const openEntity = useOpenEntity();
  const navigate = useNavigate();
  const search = useSearch({ from: '/log' });
  const [visibleCount, setVisibleCount] = useState(LOG_PAGE_SIZE);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const filters = useMemo(() => parseLogFilters(search), [search]);

  const setFilters = (patch: Partial<LogFilters>) => {
    navigate({ to: '/log', search: serializeLogFilters({ ...filters, ...patch }), replace: true });
  };

  const entities = useMemo(() => {
    const planEntities = (plans?.entries ?? []).filter(
      (p): p is PlanEntry & { id: string } => p.id != null,
    );
    return [...planEntities, ...ideaEntries].filter(
      (entity): entity is typeof entity & { id: string } => entity.id != null,
    );
  }, [plans, ideaEntries]);

  const failureIssues = useMemo(() => {
    const collected = [
      ...collectAgentRunIssues(taskLog),
      ...collectCheckIssues(checks),
      ...collectPrReviewIssues(entities),
    ];
    const kept = applyPromotions(collected, entities);
    const keptById = new Map(kept.map((issue) => [issue.id, issue]));
    return collected.map((issue) => {
      const survivor = keptById.get(issue.id);
      return {
        ...(survivor ?? issue),
        cleared: !survivor,
        thread: issueThreadFromTaskLog(issue, taskLog),
      };
    });
  }, [taskLog, checks, entities]);

  const failuresById = useMemo(
    () => new Map(failureIssues.map((issue) => [issue.id, issue])),
    [failureIssues],
  );

  const allRows = useMemo(() => {
    const rowIssues = failureIssues.filter(
      (issue) => issue.sourceKind !== 'agent-run' && !issue.cleared,
    );
    return buildLogRows(taskLog, rowIssues, agentStatus);
  }, [failureIssues, taskLog, agentStatus]);

  const availableTypes = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.type))) as LogRowType[],
    [allRows],
  );

  const matchedRows = useMemo(() => filterLogRows(allRows, filters), [allRows, filters]);

  const stats = useMemo(() => computeLogStats(matchedRows), [matchedRows]);

  const visibleRows = matchedRows.slice(0, visibleCount);

  const resolveFailure = (entry: TaskLogEntry): ResolvedFailure | undefined => {
    if (entry.outcome !== 'error') return undefined;
    const synthetic = collectAgentRunIssues([entry])[0];
    const resolved = failuresById.get(synthetic.id);
    return {
      ...synthetic,
      thread: resolved?.thread ?? [],
      promotedFixId: resolved?.promotedFixId,
      cleared: resolved?.cleared ?? false,
    };
  };

  const handlePromote = async (issue: Issue) => {
    setPromotingId(issue.id);
    try {
      await promoteIssue(issue);
      await Promise.all([loadPlans(), loadIdeas()]);
    } finally {
      setPromotingId(null);
    }
  };

  const fixingIssueId = agentStatus.find(
    (t) =>
      t.taskKind === 'issue-fix' &&
      t.status !== 'done' &&
      t.status !== 'error' &&
      t.status !== 'superseded',
  )?.issueId;

  const actions: LogRowActions = {
    entities,
    openEntity,
    resolveFailure,
    launchIssueFix,
    fixingIssueId,
    promotingId,
    handlePromote,
  };

  return {
    loading: taskLogLoading,
    rows: visibleRows,
    hasMore: matchedRows.length > visibleRows.length,
    loadMore: () => setVisibleCount((n) => n + LOG_PAGE_SIZE),
    hasAnyRows: allRows.length > 0,
    hasMatches: matchedRows.length > 0,
    stats,
    filters,
    setFilters,
    availableTypes,
    actions,
  };
};
