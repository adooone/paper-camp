import { useIdeas, useNotifications, useOpenEntity, usePlans } from '@/app/hooks';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { promoteIssue } from '@/app/services/agent-api';
import { refreshIdeas, refreshNotifications, refreshPlans } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import {
  applyPromotions,
  collectAgentRunIssues,
  collectCheckIssues,
  collectPrReviewIssues,
  issueThreadFromTaskLog,
} from '@/core/issues';
import { buildLogRows } from '@/core/run-rows';
import type { Issue, LogRow, LogRowType, PlanEntry, TaskLogEntry } from '@/types/index';
import { useEffect, useMemo, useState } from 'react';

export interface ResolvedFailure extends Issue {
  cleared: boolean;
}

export interface LogRowActions {
  entities: { id: string; title: string }[];
  plans: PlanEntry[];
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
  reloadEntities: () => Promise<void>;
}

export const useLogRows = () => {
  const taskLog = useAppStore((s) => s.taskLog);
  const taskLogLoading = useAppStore((s) => s.taskLogLoading);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const { plans } = usePlans();
  const ideaEntries = useIdeas();
  const launchIssueFix = useAppStore((s) => s.launchIssueFix);
  const { notifications } = useNotifications();
  const { checks } = useDeskChecks();
  const openEntity = useOpenEntity();
  const [promotingId, setPromotingId] = useState<string | null>(null);

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

  const allRows: LogRow[] = useMemo(() => {
    const rowIssues = failureIssues.filter(
      (issue) => issue.sourceKind !== 'agent-run' && !issue.cleared,
    );
    return buildLogRows(taskLog, rowIssues, agentStatus, notifications ?? []);
  }, [failureIssues, taskLog, agentStatus, notifications]);

  const availableTypes = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.type))) as LogRowType[],
    [allRows],
  );

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
      await Promise.all([refreshPlans(), refreshIdeas()]);
    } finally {
      setPromotingId(null);
    }
  };

  const reloadEntities = async () => {
    await Promise.all([refreshPlans(), refreshNotifications()]);
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
    plans: plans?.entries ?? [],
    openEntity,
    resolveFailure,
    launchIssueFix,
    fixingIssueId,
    promotingId,
    handlePromote,
    reloadEntities,
  };

  return {
    loading: taskLogLoading,
    allRows,
    availableTypes,
    actions,
  };
};
