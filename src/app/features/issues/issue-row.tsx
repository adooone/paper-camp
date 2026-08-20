import { FeedbackThread, PlanIdStamp } from '@/app/features/plans/components';
import type { Issue } from '@/types/index';
import { formatIssueAge } from './helpers';

interface IssueRowProps {
  issue: Issue;
  expanded: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}

export const IssueRow = ({ issue, expanded, onToggle, onOpen }: IssueRowProps) => (
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
      </div>
    )}
  </div>
);
