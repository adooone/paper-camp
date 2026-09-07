import { FeedbackThread, PlanIdStamp } from '@/app/features/plans/components';
import { useSendFeedbackMessage } from '@/app/features/plans/hooks';
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from '@/app/utils/local-draft-store';
import { formatDuration, shortModel } from '@/core/phase-run';
import { usageForEntry } from '@/core/run-rows';
import {
  AGENT_LABELS,
  type Issue,
  type LogRow,
  type ParkedQuestion,
  type PlanEntry,
  type StoredNotification,
} from '@/types/index';
import { Button, Card, Spinner, Stamp, Textarea, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';
import { formatCost, formatTime, promoteLabel, summaryLine } from '../helpers';
import type { LogRowActions } from '../hooks/use-run-rows';

interface Fact {
  label: string;
  value: string;
}

const factsFor = (row: LogRow): Fact[] => {
  const usage = row.source.kind === 'task' ? usageForEntry(row.source.entry) : undefined;
  const durationMs = usage?.durationMs ?? row.durationMs;
  const startedAt = row.source.kind === 'task' ? row.source.entry.startedAt : row.timestamp;
  const facts: Fact[] = [{ label: 'Started', value: formatTime(startedAt) }];
  if (durationMs != null) facts.push({ label: 'Duration', value: formatDuration(durationMs) });
  if (usage) {
    facts.push({ label: 'Turns', value: String(usage.numTurns) });
    facts.push({ label: 'Cost', value: formatCost(usage.costUsd) });
    if (usage.model) facts.push({ label: 'Model', value: shortModel(usage.model) });
  }
  if (row.agentId) facts.push({ label: 'Agent', value: AGENT_LABELS[row.agentId] });
  return facts;
};

const FactsGrid = ({ facts }: { facts: Fact[] }) => (
  <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-4 gap-y-2">
    {facts.map((fact) => (
      <div key={fact.label} className="flex min-w-0 flex-col">
        <dt className="font-handwritten text-xs font-semibold opacity-[0.45] whitespace-nowrap">
          {fact.label}
        </dt>
        <dd className="m-0 font-handwritten text-base font-semibold whitespace-nowrap">
          {fact.value}
        </dd>
      </div>
    ))}
  </dl>
);

const FailureActions = ({
  issue,
  cleared,
  actions,
  fixOutput,
}: {
  issue: Issue;
  cleared: boolean;
  actions: LogRowActions;
  fixOutput?: string;
}) => {
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

const ReplyBody = ({
  notification,
  actions,
}: {
  notification: StoredNotification;
  actions: LogRowActions;
}) => (
  <div className="flex flex-col gap-3">
    <p className="m-0">{notification.text}</p>
    <div>
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

const QuestionBody = ({
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

const EntryBody = ({
  row,
  actions,
  lines,
}: {
  row: LogRow;
  actions: LogRowActions;
  lines: string[] | null;
}) => {
  switch (row.source.kind) {
    case 'issue':
      return <FailureActions issue={row.source.issue} cleared={false} actions={actions} />;
    case 'reply':
      return <ReplyBody notification={row.source.notification} actions={actions} />;
    case 'question':
      return <QuestionBody question={row.source.question} actions={actions} />;
    case 'running':
      return null;
    case 'task': {
      const entry = row.source.entry;
      if (entry.outcome !== 'error') {
        const summary = lines ? summaryLine(lines) : undefined;
        return summary ? <p className="m-0 font-serif">{summary}</p> : null;
      }
      const failure = actions.resolveFailure(entry);
      if (!failure) return null;
      return (
        <FailureActions
          issue={failure}
          cleared={failure.cleared}
          actions={actions}
          fixOutput={lines?.join('\n')}
        />
      );
    }
  }
};

export interface EntryDetailsCardProps {
  row: LogRow;
  actions: LogRowActions;
  /** The run's output when the entry has one — the summary line and the fix
   * prompt read from it; `null` while it is still loading. */
  lines: string[] | null;
}

const hasBody = (row: LogRow, lines: string[] | null): boolean => {
  if (row.source.kind === 'running') return false;
  if (row.source.kind !== 'task') return true;
  if (row.source.entry.outcome === 'error') return true;
  return Boolean(lines && summaryLine(lines));
};

export const EntryDetailsCard = ({ row, actions, lines }: EntryDetailsCardProps) => {
  return (
    <Card size="small" texture="kraft" className="shrink-0">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 mr-1 font-serif text-lg font-semibold">{row.title}</h2>
          <PlanIdStamp id={row.entityId} />
          <Stamp size="small" variant="neutral">
            {LOG_TYPE_LABELS[row.type]}
          </Stamp>
          <Stamp size="small" variant={LOG_OUTCOME_VARIANT[row.outcome]}>
            {row.outcome}
          </Stamp>
        </div>
        <FactsGrid facts={factsFor(row)} />
        {hasBody(row, lines) && (
          <div className="border-t border-paper-950/[12%] pt-3">
            <EntryBody row={row} actions={actions} lines={lines} />
          </div>
        )}
      </div>
    </Card>
  );
};
