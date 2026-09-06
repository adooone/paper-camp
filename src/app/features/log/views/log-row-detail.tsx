import { FeedbackThread } from '@/app/features/plans/components';
import { useSendFeedbackMessage } from '@/app/features/plans/hooks';
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from '@/app/utils/local-draft-store';
import { formatDuration, shortModel } from '@/core/phase-run';
import type {
  AgentTaskState,
  Issue,
  LogRow,
  ParkedQuestion,
  PlanEntry,
  StoredNotification,
  TaskLogEntry,
} from '@/types/index';
import { Button, Spinner, Stamp, Textarea, useToast } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { formatCost, promoteLabel, summaryLine, usageForEntry } from '../helpers';
import type { LogRowActions, ResolvedFailure } from '../hooks/use-log-page';
import { useTaskOutput } from '../hooks/use-task-output';
import { LogOutputLinesView } from './log-output-lines';

const SuccessfulRunDetail = ({ entry }: { entry: TaskLogEntry }) => {
  const { lines, failed, retry } = useTaskOutput(entry.id);
  const usage = usageForEntry(entry);
  const summary = lines ? summaryLine(lines) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {summary && <p className="m-0">{summary}</p>}
      {usage && (
        <div className="flex flex-wrap items-center gap-2">
          <Stamp size="small" variant="neutral">
            {formatDuration(usage.durationMs)}
          </Stamp>
          <Stamp size="small" variant="neutral">
            {usage.numTurns} {usage.numTurns === 1 ? 'turn' : 'turns'}
          </Stamp>
          <Stamp size="small" variant="neutral">
            {formatCost(usage.costUsd)}
          </Stamp>
          {usage.model && (
            <Stamp size="small" variant="neutral">
              {shortModel(usage.model)}
            </Stamp>
          )}
        </div>
      )}
      <LogOutputLinesView lines={lines} failed={failed} onRetry={retry} />
    </div>
  );
};

interface FailureDetailBodyProps {
  issue: Issue;
  cleared: boolean;
  actions: LogRowActions;
  outputNode: ReactNode;
  fixOutput?: string;
}

const FailureDetailBody = ({
  issue,
  cleared,
  actions,
  outputNode,
  fixOutput,
}: FailureDetailBodyProps) => {
  const fixing = actions.fixingIssueId === issue.id;
  const promoting = actions.promotingId === issue.id;
  const promotedTitle = issue.promotedFixId
    ? (actions.entities.find((e) => e.id === issue.promotedFixId)?.title ?? issue.promotedFixId)
    : undefined;

  const handleFix = async () => {
    try {
      await actions.launchIssueFix(issue.id, issue.title, issue.reason, fixOutput ?? issue.output);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handlePromote = async () => {
    try {
      await actions.handlePromote(issue);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {cleared && (
          <Stamp size="small" variant="success">
            fixed
          </Stamp>
        )}
        <p className="m-0 text-sm text-state-danger">{issue.reason}</p>
      </div>
      {outputNode}
      {issue.thread.length > 0 && (
        <FeedbackThread messages={issue.thread} undo={null} undoing={false} onUndo={() => {}} />
      )}
      <div className="flex items-center gap-3">
        {issue.entityId && issue.entityTitle && (
          <Button
            size="small"
            onClick={() => actions.openEntity(issue.entityId, issue.entityTitle as string)}
          >
            Open
          </Button>
        )}
        {!cleared &&
          (issue.promotedFixId ? (
            <Button
              size="small"
              onClick={() => actions.openEntity(issue.promotedFixId, promotedTitle as string)}
            >
              View {issue.promotedFixId}
            </Button>
          ) : (
            <>
              <Button size="small" onClick={handleFix} disabled={Boolean(actions.fixingIssueId)}>
                {fixing ? 'Fixing…' : 'Fix it here'}
              </Button>
              {fixing && <Spinner size="small" label="Agent fixing…" />}
              <Button size="small" onClick={handlePromote} disabled={actions.promotingId !== null}>
                {promoting ? 'Promoting…' : promoteLabel(issue, actions.entities)}
              </Button>
              {promoting && <Spinner size="small" label="Promoting…" />}
            </>
          ))}
      </div>
    </div>
  );
};

const IssueDetail = ({ issue, actions }: { issue: Issue; actions: LogRowActions }) => (
  <FailureDetailBody
    issue={issue}
    cleared={false}
    actions={actions}
    outputNode={
      <LogOutputLinesView lines={issue.output ? issue.output.split('\n') : []} failed={false} />
    }
  />
);

const FailedRunDetail = ({
  entry,
  failure,
  actions,
}: {
  entry: TaskLogEntry;
  failure: ResolvedFailure;
  actions: LogRowActions;
}) => {
  const { lines, failed, retry } = useTaskOutput(entry.id);
  return (
    <FailureDetailBody
      issue={failure}
      cleared={failure.cleared}
      actions={actions}
      outputNode={<LogOutputLinesView lines={lines} failed={failed} onRetry={retry} tail={20} />}
      fixOutput={lines?.join('\n')}
    />
  );
};

const RunningDetail = ({ task }: { task: AgentTaskState }) => (
  <LogOutputLinesView lines={task.lines} failed={false} />
);

const ReplyDetail = ({
  notification,
  actions,
}: {
  notification: StoredNotification;
  actions: LogRowActions;
}) => (
  <div className="flex flex-col gap-3">
    <p className="m-0">{notification.text}</p>
    <div className="flex items-center gap-3">
      <Button
        size="small"
        onClick={() => actions.openEntity(notification.entityId, notification.entityTitle)}
      >
        Open
      </Button>
    </div>
  </div>
);

const QuestionReplyForm = ({
  plan,
  reload,
}: {
  plan: PlanEntry;
  reload: () => Promise<void>;
}) => {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const { sending, send, undo, undoing, undoEdit } = useSendFeedbackMessage(plan, {
    reload,
    notify: toast,
  });
  const draftKey = `question-reply:${plan.id}`;

  useEffect(() => {
    const draft = readLocalDraft<string>(draftKey);
    if (draft) setInput(draft);
  }, [draftKey]);

  useEffect(() => {
    if (!input) return;
    writeLocalDraft(draftKey, input);
  }, [draftKey, input]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (await send(input.trim())) {
      setInput('');
      removeLocalDraft(draftKey);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <FeedbackThread
        messages={plan.thread ?? []}
        undo={undo}
        undoing={undoing}
        onUndo={undoEdit}
      />
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label={`Reply to ${plan.title}`}
        placeholder="Reply to resolve and resume…"
        rows={2}
        disabled={sending}
      />
      <div className="flex justify-end items-center gap-3">
        <span className={sending ? 'visible' : 'invisible'}>
          <Spinner size="small" label="Agent replying…" />
        </span>
        <Button size="small" onClick={handleSend} disabled={sending || !input.trim()}>
          Reply
        </Button>
      </div>
    </div>
  );
};

const QuestionDetail = ({
  question,
  actions,
}: {
  question: ParkedQuestion;
  actions: LogRowActions;
}) => {
  const plan = actions.plans.find((p) => p.id === question.entityId);
  if (!plan) return <p className="m-0">{question.text}</p>;
  return <QuestionReplyForm plan={plan} reload={actions.reloadEntities} />;
};

export interface LogRowDetailProps {
  row: LogRow;
  actions: LogRowActions;
}

export const LogRowDetail = ({ row, actions }: LogRowDetailProps) => {
  if (row.source.kind === 'running') return <RunningDetail task={row.source.task} />;
  if (row.source.kind === 'issue')
    return <IssueDetail issue={row.source.issue} actions={actions} />;
  if (row.source.kind === 'reply')
    return <ReplyDetail notification={row.source.notification} actions={actions} />;
  if (row.source.kind === 'question')
    return <QuestionDetail question={row.source.question} actions={actions} />;

  const entry = row.source.entry;
  if (entry.outcome !== 'error') return <SuccessfulRunDetail entry={entry} />;

  const failure = actions.resolveFailure(entry);
  if (!failure) return null;
  return <FailedRunDetail entry={entry} failure={failure} actions={actions} />;
};
