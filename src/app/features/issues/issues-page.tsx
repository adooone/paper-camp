import { PageTitle } from '@/app/components/page-title';
import { entityRouteParam } from '@/app/hooks';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import {
  collectAgentRunIssues,
  collectCheckIssues,
  collectPrReviewIssues,
  issueThreadFromTaskLog,
} from '@/core/issues';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { sortIssuesByAge } from './helpers';
import { IssueRow } from './issue-row';

export const IssuesPage = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const taskLog = useAppStore((s) => s.taskLog);
  const taskLogLoading = useAppStore((s) => s.taskLogLoading);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);
  const plans = useAppStore((s) => s.plans);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const launchIssueFix = useAppStore((s) => s.launchIssueFix);
  const { checks } = useDeskChecks();
  const navigate = useNavigate();

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const issues = useMemo(() => {
    const entities = [...(plans?.entries ?? []), ...ideaEntries].filter(
      (entity): entity is typeof entity & { id: string } => entity.id != null,
    );
    const collected = sortIssuesByAge([
      ...collectAgentRunIssues(taskLog),
      ...collectCheckIssues(checks),
      ...collectPrReviewIssues(entities),
    ]);
    return collected.map((issue) => ({
      ...issue,
      thread: issueThreadFromTaskLog(issue, taskLog),
    }));
  }, [taskLog, checks, plans, ideaEntries]);

  const openEntity = (id: string, title: string) => {
    if (plans?.entries.some((p) => p.id === id || p.title === title)) {
      navigate({ to: '/plans/$planId', params: { planId: entityRouteParam(id, title) } });
    } else {
      navigate({ to: '/ideas/$ideaId', params: { ideaId: entityRouteParam(id, title) } });
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
          {issues.map((issue) => (
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
