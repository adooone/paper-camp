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
import type { Issue, PlanEntry } from '@/types/index';
import { useEffect, useMemo, useState } from 'react';
import { sortIssuesByAge } from '../helpers';

export const useIssuesPage = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const taskLog = useAppStore((s) => s.taskLog);
  const taskLogLoading = useAppStore((s) => s.taskLogLoading);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);
  const plans = useAppStore((s) => s.plans);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const launchIssueFix = useAppStore((s) => s.launchIssueFix);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const { checks } = useDeskChecks();
  const openEntity = useOpenEntity();

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const planEntities = useMemo(
    () => (plans?.entries ?? []).filter((p): p is PlanEntry & { id: string } => p.id != null),
    [plans],
  );

  const entities = useMemo(
    () =>
      [...planEntities, ...ideaEntries].filter(
        (entity): entity is typeof entity & { id: string } => entity.id != null,
      ),
    [planEntities, ideaEntries],
  );

  const issues = useMemo(() => {
    const collected = sortIssuesByAge([
      ...collectAgentRunIssues(taskLog),
      ...collectCheckIssues(checks),
      ...collectPrReviewIssues(entities),
    ]);
    return applyPromotions(collected, entities).map((issue) => ({
      ...issue,
      thread: issueThreadFromTaskLog(issue, taskLog),
    }));
  }, [taskLog, checks, entities]);

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

  return {
    issues,
    entities,
    taskLogLoading,
    expandedId,
    setExpandedId,
    openEntity,
    fixingIssueId,
    launchIssueFix,
    promotingId,
    handlePromote,
  };
};
