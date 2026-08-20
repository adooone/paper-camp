import { PageTitle } from '@/app/components/page-title';
import { entityRouteParam } from '@/app/hooks';
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
import { isClosedEntity } from '@/core/status';
import type { Issue, PlanEntry } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { sortIssuesByAge } from './helpers';
import { IssueRow } from './issue-row';

const promoteLabel = (issue: Issue, planEntities: PlanEntry[]): string => {
  const parent = issue.entityId ? planEntities.find((p) => p.id === issue.entityId) : undefined;
  if (!parent) return 'Promote to idea';
  return isClosedEntity(parent) ? 'Promote to fix' : `Add to ${parent.id}'s fixes`;
};

export const IssuesPage = () => {
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
  const navigate = useNavigate();

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const planEntities = useMemo(
    () => (plans?.entries ?? []).filter((p): p is PlanEntry & { id: string } => p.id != null),
    [plans],
  );

  const issues = useMemo(() => {
    const entities = [...planEntities, ...ideaEntries].filter(
      (entity): entity is typeof entity & { id: string } => entity.id != null,
    );
    const collected = sortIssuesByAge([
      ...collectAgentRunIssues(taskLog),
      ...collectCheckIssues(checks),
      ...collectPrReviewIssues(entities),
    ]);
    return applyPromotions(collected, planEntities).map((issue) => ({
      ...issue,
      thread: issueThreadFromTaskLog(issue, taskLog),
    }));
  }, [taskLog, checks, planEntities, ideaEntries]);

  const openEntity = (id: string, title: string) => {
    if (plans?.entries.some((p) => p.id === id || p.title === title)) {
      navigate({ to: '/plans/$planId', params: { planId: entityRouteParam(id, title) } });
    } else {
      navigate({ to: '/ideas/$ideaId', params: { ideaId: entityRouteParam(id, title) } });
    }
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

  return (
    <div>
      <PageTitle>Issues</PageTitle>
      <p className="opacity-50 mb-6">
        Every failing agent run, red check, and PR review, oldest first.
      </p>
      {taskLogLoading && issues.length === 0 && <p className="opacity-50">Loading…</p>}
      {!taskLogLoading && issues.length === 0 && (
        <p className="opacity-50">Nothing broken right now.</p>
      )}
      {issues.length > 0 && (
        <div className="flex flex-col">
          {issues.map((issue) => {
            const promotedTitle = issue.promotedFixId
              ? (planEntities.find((p) => p.id === issue.promotedFixId)?.title ??
                issue.promotedFixId)
              : undefined;
            return (
              <IssueRow
                key={issue.id}
                issue={issue}
                expanded={expandedId === issue.id}
                onToggle={() => setExpandedId((cur) => (cur === issue.id ? null : issue.id))}
                onOpen={
                  issue.entityId && issue.entityTitle
                    ? () => openEntity(issue.entityId as string, issue.entityTitle as string)
                    : undefined
                }
                fixing={fixingIssueId === issue.id}
                fixDisabled={fixingIssueId !== undefined}
                onFix={() => launchIssueFix(issue.id, issue.title, issue.reason, issue.output)}
                promoteLabel={promoteLabel(issue, planEntities)}
                promoting={promotingId === issue.id}
                promoteDisabled={promotingId !== null}
                onPromote={() => handlePromote(issue)}
                onOpenPromoted={
                  issue.promotedFixId
                    ? () => openEntity(issue.promotedFixId as string, promotedTitle as string)
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
