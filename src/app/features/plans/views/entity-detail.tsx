import { detailHeadingClassName } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import {
  type RunningPhaseFill,
  useFeedbackQuietSummary,
  usePlanStatusPatch,
  usePromoteThreadMessage,
  useRunningPhaseFill,
  useSendFeedbackMessage,
  useTrail,
} from '@/app/features/plans/hooks';
import { createPlanBranch } from '@/app/services/git-api';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { IdeaEntry, LogEntry, PhaseItem, PlanEntry } from '@/types/index';
import {
  Button,
  Card,
  Checkbox,
  Spinner,
  Stamp,
  Table,
  Textarea,
  Tooltip,
  useToast,
} from '@dendelion/paper-ui';
import { type CSSProperties, useEffect, useState } from 'react';
import { DraftPlanButton, ExtendIdeaButton, RefreshButton } from '../actions';
import { ReconcileButton } from '../actions';
import {
  AddReviewPhasesButton,
  AgentStartButton,
  AuditPhasesButton,
  PhaseCopyButton,
} from '../actions';
import { CollapsibleText } from '../components';
import { FeedbackThread, type PromoteTarget } from '../components';
import { PlanIdStamp } from '../components';
import { ProgressBar } from '../components';
import { PrBadge, ReviewSignalBadge } from '../components';
import { ProvenanceTrailPanel } from '../components';
import { STATUS_COLOR, STATUS_STAMP } from '../constants';
import { combinedProgress, effectiveStatus, relativeDate, runningTaskForPlan } from '../helpers';
import { CreateIdeaModal } from '../modals/create-idea-modal';

interface EntityDetailProps {
  plan: PlanEntry;
}

/** Parses the entity id a feature branch encodes (feat/idea-43-… → IDEA-43). */
function branchEntityId(branch: string | null): string | null {
  const match = branch?.match(/^[a-z]+\/([a-z]+-\d+)-/);
  return match ? match[1].toUpperCase() : null;
}

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

// Phases and post-build fixes share one table; fixes are appended and tinted
// (`.fix-row`) so they read as part of the same list, distinct only by colour.
type WorkRow = { kind: 'phase' | 'fix'; item: PhaseItem; index: number };

const PhasesSection = ({
  plan,
  auditRunning,
  agentBusy,
  runningFill,
  updating,
  onTogglePhase,
  onToggleFix,
  onAddReviewPhases,
}: {
  plan: PlanEntry;
  auditRunning: boolean;
  agentBusy: boolean;
  runningFill: RunningPhaseFill | null;
  updating: boolean;
  onTogglePhase: (index: number) => void;
  onToggleFix: (index: number) => void;
  onAddReviewPhases: (newPhases: PhaseItem[]) => Promise<void>;
}) => {
  const launchRunAll = useAppStore((s) => s.launchRunAll);
  const fixes = plan.fixes ?? [];
  const hasOpenFix = fixes.some((fix) => !fix.done);
  const rows: WorkRow[] = [
    ...plan.phases.map((item, index) => ({ kind: 'phase' as const, item, index })),
    ...fixes.map((item, index) => ({ kind: 'fix' as const, item, index })),
  ];
  const isRunningRow = (row: WorkRow) =>
    row.kind === 'phase' && !row.item.done && runningFill?.index === row.index;
  return (
    <div
      className="mb-8"
      style={
        runningFill
          ? ({ '--phase-fill': `${runningFill.fraction * 100}%` } as CSSProperties)
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className={`${sectionHeadingClass} m-0`}>Phases</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {auditRunning && <Spinner size="small" label="Audit running…" />}
          {(plan.status === 'review' || plan.status === 'done') && (
            <AuditPhasesButton plan={plan} />
          )}
          {plan.status !== 'done' && <ReconcileButton plan={plan} />}
          <AddReviewPhasesButton onAdd={onAddReviewPhases} disabled={updating} />
          {plan.id && hasOpenFix && (
            <Tooltip content="Run the open fixes with an agent">
              <Button
                size="small"
                onClick={() => plan.id && launchRunAll(plan.id)}
                disabled={agentBusy}
              >
                {agentBusy ? 'Running…' : 'Run fixes'}
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <Table
        data={rows}
        columns={[
          {
            key: 'checkbox',
            header: 'Status',
            cell: (row: WorkRow) =>
              isRunningRow(row) ? (
                <Spinner size="small" />
              ) : (
                <Checkbox
                  checked={row.item.done}
                  onChange={() =>
                    row.kind === 'phase' ? onTogglePhase(row.index) : onToggleFix(row.index)
                  }
                  disabled={updating}
                />
              ),
            width: 2,
          },
          {
            key: 'title',
            header: 'Title',
            cell: (row: WorkRow) => (
              <span
                className={`inline-flex items-center gap-2 ${row.item.done ? 'line-through opacity-[0.45]' : 'no-underline'}`}
              >
                {row.item.text}
                {isRunningRow(row) && (
                  <span className="text-xs opacity-[0.55]">
                    {Math.round((runningFill?.fraction ?? 0) * 100)}%
                  </span>
                )}
                {row.kind === 'phase' && row.item.source === 'review' && (
                  <Stamp
                    size="small"
                    fillColor={STATUS_STAMP.review.fill}
                    textColor={STATUS_STAMP.review.text}
                  >
                    review
                  </Stamp>
                )}
                {row.kind === 'fix' && (
                  <Stamp size="small" variant="warning">
                    fix
                  </Stamp>
                )}
              </span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'end',
            cell: (row: WorkRow) => {
              if (row.kind !== 'phase' || isRunningRow(row)) return null;
              return row.item.done ? (
                <PhaseCopyButton planTitle={plan.title} planId={plan.id} phaseIndex={row.index} />
              ) : (
                <AgentStartButton planId={plan.id} phaseIndex={row.index} disabled={agentBusy} />
              );
            },
            width: 7,
          },
        ]}
        expandable={{
          render: (row: WorkRow) => row.item.description || null,
        }}
        showExpandColumn={false}
        rowTexture={(row: WorkRow) => (row.kind === 'fix' ? 'kraft' : undefined)}
        rowClassName={(row: WorkRow) => {
          if (isRunningRow(row)) return 'phase-running-row';
          if (row.kind === 'phase' && row.item.done) return 'phase-done-row';
          if (row.kind === 'phase' && row.item.source === 'review') {
            return 'bg-[rgba(155,122,181,0.08)]';
          }
          return undefined;
        }}
        className="phase-table-phone"
      />
    </div>
  );
};

const BranchRow = ({
  plan,
  gitBranch,
  onOwnBranch,
  branching,
  onCreateBranch,
}: {
  plan: PlanEntry;
  gitBranch: string | null;
  onOwnBranch: boolean;
  branching: boolean;
  onCreateBranch: () => void;
}) => {
  const showBranchRow =
    plan.status === 'planned' || plan.status === 'in-progress' || plan.status === 'review';
  if (!showBranchRow && !plan.pr) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap mb-4">
      {showBranchRow && !onOwnBranch && (
        <Card size="small" accent accentColor="amber" texture="kraft">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm">
              Working branch: <code>{gitBranch ?? 'unknown'}</code> — not this plan's branch.
            </span>
            {plan.id && (
              <Tooltip
                content={`Creates ${(plan.kind ?? 'feat').toLowerCase()}/${plan.id.toLowerCase()}-… from main, or switches to it if it already exists`}
              >
                <Button size="small" onClick={onCreateBranch} disabled={branching}>
                  {branching ? 'Switching…' : 'Create branch'}
                </Button>
              </Tooltip>
            )}
          </div>
        </Card>
      )}
      {showBranchRow && onOwnBranch && (
        <span className="text-sm opacity-[0.45]">
          Working branch: <code>{gitBranch}</code>
        </span>
      )}
      {plan.pr && <PrBadge pr={plan.pr} />}
      {plan.pr && <ReviewSignalBadge pr={plan.pr} />}
    </div>
  );
};

const PlanProgressBar = ({
  progress,
  color: barColor,
}: {
  progress: { pct: number; done: number; total: number };
  color: string;
}) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="flex-1">
      <ProgressBar pct={progress.pct} color={barColor} />
    </div>
    <span className="text-sm opacity-50 flex-shrink-0">
      {progress.done}/{progress.total}
    </span>
  </div>
);

const PlanBodySection = ({ plan }: { plan: PlanEntry }) => (
  <div className="mb-4">
    <div className="opacity-[0.85]">
      {plan.body && (
        <CollapsibleText resetKey={plan.id ?? plan.title}>
          <Markdown>{plan.body}</Markdown>
        </CollapsibleText>
      )}
    </div>
  </div>
);

const ClarificationsSection = ({ clarifications }: { clarifications: LogEntry[] }) => {
  if (clarifications.length === 0) return null;
  return (
    <div className="mb-5">
      <h3 className={`${sectionHeadingClass} mb-3`}>Clarifications</h3>
      <div className="flex flex-col gap-2 mb-3">
        {clarifications.map((entry, i) => (
          <div
            key={`clar-${entry.date}-${i}`}
            className="text-sm flex items-start justify-between gap-3 opacity-75"
          >
            <span>
              <span className="font-semibold mr-2">{entry.date}</span>
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TrailSection = ({ planId, released }: { planId: string | undefined; released?: string }) => {
  const trail = useTrail(planId);
  if (!trail) return null;
  return (
    <div className="mb-8">
      <h3 className={`${sectionHeadingClass} mb-3`}>History</h3>
      <ProvenanceTrailPanel trail={trail} released={released} />
    </div>
  );
};

const FeedbackSection = ({
  plan,
  updating,
  onSend,
  undo,
  undoing,
  onUndo,
}: {
  plan: PlanEntry;
  updating: boolean;
  onSend: (text: string) => Promise<boolean>;
  undo: { commitSha: string } | null;
  undoing: boolean;
  onUndo: () => void;
}) => {
  const [input, setInput] = useState('');
  const [ideaPromptIndex, setIdeaPromptIndex] = useState<number | null>(null);
  const thread = plan.thread ?? [];
  const { promotingIndex, promoteToDurable, promoteToIdea } = usePromoteThreadMessage(plan);
  useFeedbackQuietSummary(plan, true);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (await onSend(input.trim())) setInput('');
  };

  const handlePromote = (index: number, target: PromoteTarget) => {
    if (target === 'idea') setIdeaPromptIndex(index);
    else promoteToDurable(index, target);
  };

  const handlePromoteToIdea = async (idea: {
    title: string;
    content?: string;
    kind?: 'idea' | 'note';
  }) => {
    if (ideaPromptIndex === null) return;
    if (await promoteToIdea(ideaPromptIndex, idea)) setIdeaPromptIndex(null);
  };

  return (
    <div className="mb-8">
      <h3 className={`${sectionHeadingClass} mb-3`}>Feedback</h3>
      <Card size="small" accent accentColor="slate" texture="kraft">
        <div className="flex flex-col gap-3 mb-4">
          {thread.length > 0 ? (
            <FeedbackThread
              messages={thread}
              undo={undo}
              undoing={undoing}
              onUndo={onUndo}
              onPromote={handlePromote}
              promotingIndex={promotingIndex}
            />
          ) : (
            <p className="text-sm m-0 text-ink-500">
              Jot a comment, ask a question, or say what's wrong with this plan.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Feedback message"
            placeholder="Write a message…"
            rows={3}
            disabled={updating}
          />
          <div className="flex justify-end items-center gap-3">
            <span className={updating ? 'visible' : 'invisible'}>
              <Spinner size="small" label="Agent replying…" />
            </span>
            <Button size="small" onClick={handleSend} disabled={updating || !input.trim()}>
              Send
            </Button>
          </div>
        </div>
      </Card>
      <CreateIdeaModal
        open={ideaPromptIndex !== null}
        onClose={() => setIdeaPromptIndex(null)}
        onAdd={handlePromoteToIdea}
        initialContent={ideaPromptIndex !== null ? thread[ideaPromptIndex]?.text : undefined}
      />
    </div>
  );
};

export const EntityDetail = ({ plan }: EntityDetailProps) => {
  const allPlans = useAppStore((s) => s.plans);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const { toast } = useToast();
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
  const [branching, setBranching] = useState(false);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const agentBusy = useAppStore(selectAgentBusy);
  const detailView = useAppStore((s) => s.detailView);
  const taskLog = useAppStore((s) => s.taskLog);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);
  const planTask = runningTaskForPlan(plan.id, agentStatus);
  const runningFill = useRunningPhaseFill(planTask, taskLog);
  const auditRunning = planTask?.taskKind === 'audit';
  const progress = combinedProgress(plan);
  const hasPhases = plan.phases.length > 0;
  const showFeedback = detailView === 'feedback';
  const ideaView: IdeaEntry = {
    id: plan.id ?? null,
    title: plan.title,
    body: plan.body,
    log: plan.log,
  };
  const otherPlans = (allPlans?.entries ?? []).filter((p) => p.id !== plan.id);
  // The app never switches branches on its own; this just offers the plan's branch as one click.
  const onOwnBranch = plan.id !== undefined && branchEntityId(gitBranch) === plan.id;

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const handleCreateBranch = async () => {
    if (!plan.id) return;
    setBranching(true);
    try {
      const branch = await createPlanBranch(plan.id);
      toast({ title: 'Branch ready', description: `Now on ${branch}`, variant: 'success' });
      await loadGitStatus();
    } catch (err) {
      toast({
        title: 'Branch failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setBranching(false);
    }
  };

  const handleTogglePhase = async (index: number) => {
    const nextPhases: PhaseItem[] = plan.phases.map((phase, i) =>
      i === index ? { ...phase, done: !phase.done } : phase,
    );
    const allChecked = nextPhases.every((p) => p.done);
    if (allChecked && plan.status === 'in-progress') {
      await patchByTitle(plan.title, { phases: nextPhases, status: 'review' });
    } else {
      await patchByTitle(plan.title, { phases: nextPhases });
    }
  };

  const handleAddReviewPhases = async (newPhases: PhaseItem[]) => {
    await patchByTitle(plan.title, { phases: [...plan.phases, ...newPhases] });
  };

  const handleToggleFix = async (index: number) => {
    const nextFixes: PhaseItem[] = (plan.fixes ?? []).map((fix, i) =>
      i === index ? { ...fix, done: !fix.done } : fix,
    );
    const allChecked = nextFixes.every((f) => f.done);
    if (allChecked && plan.status === 'in-progress') {
      await patchByTitle(plan.title, { fixes: nextFixes, status: 'review' });
    } else {
      await patchByTitle(plan.title, { fixes: nextFixes });
    }
  };

  const {
    sending,
    send: sendFeedbackMessage,
    undo: feedbackUndo,
    undoing: undoingFeedback,
    undoEdit,
  } = useSendFeedbackMessage(plan, { reload: loadPlans, notify: toast });

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className={`${detailHeadingClassName} m-0 flex items-center gap-3 min-w-0 flex-wrap`}>
          <PlanIdStamp id={plan.id} />
          {plan.title}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm opacity-[0.45] whitespace-nowrap">
            {plan.updated
              ? `updated ${relativeDate(plan.updated)}`
              : `created ${relativeDate(plan.created)}`}
          </span>
          <RefreshButton />
        </div>
      </div>

      {showFeedback ? (
        <FeedbackSection
          plan={plan}
          updating={sending}
          onSend={sendFeedbackMessage}
          undo={feedbackUndo}
          undoing={undoingFeedback}
          onUndo={undoEdit}
        />
      ) : (
        <>
          <BranchRow
            plan={plan}
            gitBranch={gitBranch}
            onOwnBranch={onOwnBranch}
            branching={branching}
            onCreateBranch={handleCreateBranch}
          />

          {progress !== null && (
            <PlanProgressBar
              progress={progress}
              color={STATUS_COLOR[effectiveStatus(plan, agentStatus)]}
            />
          )}

          <PlanBodySection plan={plan} />

          <ClarificationsSection clarifications={plan.clarifications ?? []} />

          {!hasPhases && (
            <div className="flex items-center gap-3 mb-8">
              <DraftPlanButton idea={ideaView} otherPlans={otherPlans} />
              <ExtendIdeaButton idea={ideaView} />
            </div>
          )}

          {hasPhases && (
            <PhasesSection
              plan={plan}
              auditRunning={auditRunning}
              agentBusy={agentBusy}
              runningFill={runningFill}
              updating={updating}
              onTogglePhase={handleTogglePhase}
              onToggleFix={handleToggleFix}
              onAddReviewPhases={handleAddReviewPhases}
            />
          )}

          <TrailSection planId={plan.id} released={plan.released} />
        </>
      )}
    </div>
  );
};
