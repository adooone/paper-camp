import { FeedbackThread, PlanIdStamp } from '@/app/features/plans/components';
import type { Issue } from '@/types/index';
import { Button, Spinner } from '@dendelion/paper-ui';
import { formatIssueAge } from './helpers';

interface IssueRowProps {
  issue: Issue;
  expanded: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  fixing: boolean;
  fixDisabled: boolean;
  onFix: () => Promise<void>;
  promoteLabel: string;
  promoting: boolean;
  promoteDisabled: boolean;
  onPromote: () => Promise<void>;
  onOpenPromoted?: () => void;
}

export const IssueRow = ({
  issue,
  expanded,
  onToggle,
  onOpen,
  fixing,
  fixDisabled,
  onFix,
  promoteLabel,
  promoting,
  promoteDisabled,
  onPromote,
  onOpenPromoted,
}: IssueRowProps) => {
  const handleFix = async () => {
    try {
      await onFix();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handlePromote = async () => {
    try {
      await onPromote();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="border-b border-black/10 last:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${issue.entityTitle}`}
            className="bg-transparent border-none p-0 cursor-pointer"
          >
            <PlanIdStamp id={issue.entityId} />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex-1 min-w-0 truncate text-left bg-transparent border-none p-0 cursor-pointer"
        >
          {issue.title}
        </button>
        <span className="opacity-50 text-xs whitespace-nowrap">
          {formatIssueAge(issue.occurredAt)}
        </span>
      </div>
      {expanded && (
        <div className="flex flex-col gap-3 pb-4">
          <p>{issue.reason}</p>
          {issue.output && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-left font-mono text-2xs opacity-70">
              {issue.output}
            </pre>
          )}
          {issue.thread.length > 0 && (
            <FeedbackThread messages={issue.thread} undo={null} undoing={false} onUndo={() => {}} />
          )}
          <div className="flex items-center gap-3">
            {issue.promotedFixId ? (
              <Button size="small" onClick={onOpenPromoted}>
                View {issue.promotedFixId}
              </Button>
            ) : (
              <>
                <Button size="small" onClick={handleFix} disabled={fixDisabled}>
                  {fixing ? 'Fixing…' : 'Fix it here'}
                </Button>
                {fixing && <Spinner size="small" label="Agent fixing…" />}
                <Button size="small" onClick={handlePromote} disabled={promoteDisabled}>
                  {promoting ? 'Promoting…' : promoteLabel}
                </Button>
                {promoting && <Spinner size="small" label="Promoting…" />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
