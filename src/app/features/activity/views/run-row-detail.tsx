import { FeedbackThread, PlanIdStamp } from '@/app/features/plans/components';
import { useSendFeedbackMessage } from '@/app/features/plans/hooks';
import { useAppStore } from '@/app/stores/app-store';
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
import {
  Button,
  Card,
  type FactItem,
  FactsGrid,
  Spinner,
  Stamp,
  Textarea,
  useToast,
} from '@dendelion/folk-ui';
import { surface } from '@dendelion/folk-ui/tokens';
import { useEffect, useState } from 'react';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';
import { formatCost, formatFullTimestamp, promoteLabel, summaryLine } from '../helpers';
import type { LogRowActions } from '../hooks/use-run-rows';

const phaseFact = (row: LogRow, plans: PlanEntry[]): FactItem | undefined => {
  if (row.source.kind === 'running') {
    const { task } = row.source;
    if (task.phaseIndex === undefined) return undefined;
    const phaseCount = plans.find((p) => p.id === task.planId)?.phases.length;
    return {
      label: 'Phase',
      value: `${task.phaseIndex + 1}${phaseCount ? ` of ${phaseCount}` : ''}`,
    };
  }
  if (row.source.kind === 'task') {
    const { entry } = row.source;
    const lastPhaseRun = entry.phaseRuns?.at(-1);
    if (!lastPhaseRun) return undefined;
    const phaseCount = plans.find((p) => p.id === entry.planId)?.phases.length;
    return {
      label: 'Phase',
      value: `${lastPhaseRun.index + 1}${phaseCount ? ` of ${phaseCount}` : ''}`,
    };
  }
  return undefined;
};

const factsFor = (row: LogRow, plans: PlanEntry[]): FactItem[] => {
  const usage = row.source.kind === 'task' ? usageForEntry(row.source.entry) : undefined;
  const durationMs = usage?.durationMs ?? row.durationMs;
  const startedAt = row.source.kind === 'task' ? row.source.entry.startedAt : row.timestamp;
  const facts: FactItem[] = [{ label: 'Started', value: formatFullTimestamp(startedAt) }];
  if (row.source.kind === 'running') {
    const elapsed = Date.now() - Date.parse(startedAt);
    if (Number.isFinite(elapsed)) facts.push({ label: 'Elapsed', value: formatDuration(elapsed) });
  } else if (durationMs != null) facts.push({ label: 'Took', value: formatDuration(durationMs) });
  const phase = phaseFact(row, plans);
  if (phase) facts.push(phase);
  if (usage) {
    facts.push({ label: 'Turns', value: String(usage.numTurns) });
    facts.push({ label: 'Cost', value: formatCost(usage.costUsd) });
    if (usage.model) facts.push({ label: 'Model', value: shortModel(usage.model) });
  }
  if (row.agentId) facts.push({ label: 'Agent', value: AGENT_LABELS[row.agentId] });
  return facts;
};

const FailureReason = ({ issue, cleared }: { issue: Issue; cleared: boolean }) => (
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
  </div>
);

const FailureTitleActions = ({
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
    <div className="flex shrink-0 items-center gap-2">
      {issue.entityId && issue.entityTitle && (
        <Button
          size="small"
          variant="ghost"
          onClick={() => actions.openEntity(issue.entityId, issue.entityTitle as string)}
        >
          Open idea
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
  );
};

const ReplyBody = ({ notification }: { notification: StoredNotification }) => (
  <p className="m-0">{notification.text}</p>
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

const resolveRowFailure = (
  row: LogRow,
  actions: LogRowActions,
  lines: string[] | null,
): { issue: Issue; cleared: boolean; fixOutput?: string } | undefined => {
  if (row.source.kind === 'issue') return { issue: row.source.issue, cleared: false };
  if (row.source.kind === 'task' && row.source.entry.outcome === 'error') {
    const failure = actions.resolveFailure(row.source.entry);
    if (failure) return { issue: failure, cleared: failure.cleared, fixOutput: lines?.join('\n') };
  }
  return undefined;
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
      return <FailureReason issue={row.source.issue} cleared={false} />;
    case 'reply':
      return <ReplyBody notification={row.source.notification} />;
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
      const failure = resolveRowFailure(row, actions, lines);
      return failure ? <FailureReason issue={failure.issue} cleared={failure.cleared} /> : null;
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

export const StopRunButton = ({ taskId, className }: { taskId: string; className?: string }) => {
  const stopAgent = useAppStore((s) => s.stopAgent);
  const [stopping, setStopping] = useState(false);
  return (
    <Button
      size="small"
      variant="danger"
      className={className}
      disabled={stopping}
      onClick={async () => {
        setStopping(true);
        try {
          await stopAgent(taskId);
        } finally {
          setStopping(false);
        }
      }}
    >
      {stopping ? 'Stopping…' : 'Stop'}
    </Button>
  );
};

const OpenIdeaButton = ({ row, actions }: { row: LogRow; actions: LogRowActions }) =>
  row.entityId && row.entityTitle ? (
    <Button
      size="small"
      variant="ghost"
      onClick={() => actions.openEntity(row.entityId, row.entityTitle as string)}
    >
      Open idea
    </Button>
  ) : null;

export const EntryDetailsCard = ({ row, actions, lines }: EntryDetailsCardProps) => {
  const runningTask = row.source.kind === 'running' ? row.source.task : null;
  const failure = runningTask ? undefined : resolveRowFailure(row, actions, lines);

  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="m-0 mr-1 font-serif text-lg font-semibold">{row.title}</h1>
        <PlanIdStamp id={row.entityId} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {runningTask ? (
            <>
              <OpenIdeaButton row={row} actions={actions} />
              {runningTask.status !== 'stopping' && <StopRunButton taskId={runningTask.id} />}
            </>
          ) : failure ? (
            <FailureTitleActions
              issue={failure.issue}
              cleared={failure.cleared}
              actions={actions}
              fixOutput={failure.fixOutput}
            />
          ) : (
            <OpenIdeaButton row={row} actions={actions} />
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Stamp size="small" variant="neutral">
          {LOG_TYPE_LABELS[row.type]}
        </Stamp>
        <Stamp size="small" variant={LOG_OUTCOME_VARIANT[row.outcome]}>
          {row.outcome}
        </Stamp>
        <FactsGrid items={factsFor(row, actions.plans)} layout="inline" />
      </div>
      {hasBody(row, lines) && (
        <Card size="small" texture={surface.card}>
          <EntryBody row={row} actions={actions} lines={lines} />
        </Card>
      )}
    </div>
  );
};
