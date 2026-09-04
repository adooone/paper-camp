import { EmptyState } from '@/app/components';
import { EmptyTrayIllustration } from '@/app/components/empty-state-illustrations';
import { PageTitle } from '@/app/components/page-title';
import { promoteLabel } from './helpers';
import { useIssuesPage } from './hooks';
import { IssueRow } from './issue-row';

export const IssuesPage = () => {
  const {
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
  } = useIssuesPage();

  return (
    <div>
      <PageTitle>Issues</PageTitle>
      <p className="opacity-50 mb-6">
        Every failing agent run, red check, and PR review, oldest first.
      </p>
      {taskLogLoading && issues.length === 0 && <p className="opacity-50">Loading…</p>}
      {!taskLogLoading && issues.length === 0 && (
        <EmptyState illustration={<EmptyTrayIllustration />} message="Nothing broken right now." />
      )}
      {issues.length > 0 && (
        <div className="flex flex-col">
          {issues.map((issue) => {
            const promotedTitle = issue.promotedFixId
              ? (entities.find((p) => p.id === issue.promotedFixId)?.title ?? issue.promotedFixId)
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
                promoteLabel={promoteLabel(issue, entities)}
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
