import { CommitMessageFields } from '@/app/components';
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
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from '@/app/utils/local-draft-store';
import { type UsageRollup, formatDuration, formatTokens, rollupUsage } from '@/core/phase-run';
import type { IdeaEntry, LogEntry, PhaseItem, PlanEntry } from '@/types/index';
import {
  Accordion,
  Button,
  Card,
  Checkbox,
  Divider,
  Skeleton,
  Spinner,
  Stamp,
  Table,
  Textarea,
  Tooltip,
  useToast,
} from '@dendelion/paper-ui';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { DraftPlanButton, ExtendIdeaButton, RefreshButton } from '../actions';
import { ReconcileButton } from '../actions';
import { AddReviewPhasesButton, AgentStartButton, AuditPhasesButton } from '../actions';
import {
  DeliverChangedFiles,
  DeliverChecksRow,
  DeliverCommitButton,
  DeliverEmptyState,
  useDeliverCommitForm,
} from '../components';
import { FeedbackThread, type PromoteTarget } from '../components';
import { PlanIdStamp } from '../components';
import { ProgressBar } from '../components';
import { ProvenanceTrailPanel } from '../components';
import { STATUS_COLOR, STATUS_STAMP } from '../constants';
import {
  effectiveStatus,
  latestReviewNote,
  relativeDate,
  rollupProgress,
  runningPrReviewForPlan,
  runningTaskForPlan,
} from '../helpers';
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

function formatRunSummary(run: NonNullable<PhaseItem['run']>): string {
  return `${formatTokens(run.inputTokens + run.outputTokens)} tokens · ${formatDuration(run.durationMs)}${run.attempts > 1 ? ` ×${run.attempts}` : ''}${run.model ? ` · ${run.model}` : ''}`;
}

const RunCostSummary = ({ rollup }: { rollup: UsageRollup }) => {
  if (rollup.runs === 0) return null;
  return (
    <div className="flex items-center gap-2 text-xs opacity-[0.55] flex-wrap flex-shrink-0 ml-auto">
      <span className="font-semibold opacity-[0.85]">Run cost</span>
      <span aria-hidden>·</span>
      <span>
        {rollup.runs} {rollup.runs === 1 ? 'run' : 'runs'}
      </span>
      <span aria-hidden>·</span>
      <span>{formatDuration(rollup.durationMs)}</span>
      <span aria-hidden>·</span>
      <Tooltip
        content={`Cache: ${formatTokens(rollup.cacheCreationTokens)} write · ${formatTokens(rollup.cacheReadTokens)} read`}
      >
        <span>
          {formatTokens(rollup.inputTokens)} in · {formatTokens(rollup.outputTokens)} out
        </span>
      </Tooltip>
    </div>
  );
};

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
      <Table
        data={rows}
        toolbar={{
          title: <h3 className={`${sectionHeadingClass} m-0`}>Phases</h3>,
          actions: (
            <>
              {auditRunning && <Spinner size="small" label="Audit running…" />}
              {(plan.status === 'review' || plan.status === 'done') && (
                <AuditPhasesButton plan={plan} />
              )}
              {plan.status !== 'done' && <ReconcileButton plan={plan} />}
              <AddReviewPhasesButton
                onAdd={onAddReviewPhases}
                disabled={updating}
                entityId={plan.id ?? plan.title}
              />
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
            </>
          ),
        }}
        panelFooter={<DeliverSection plan={plan} />}
        columns={[
          {
            key: 'checkbox',
            header: '',
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
            width: 1,
          },
          {
            key: 'title',
            header: 'Title',
            width: 6,
            cell: (row: WorkRow) => (
              <span
                className={`inline-flex min-w-0 max-w-full items-center gap-2 ${row.item.done ? 'line-through opacity-[0.45]' : 'no-underline'}`}
              >
                <span
                  title={row.item.text}
                  className="overflow-hidden text-ellipsis whitespace-nowrap font-handwritten text-base leading-tight"
                >
                  {row.item.text}
                </span>
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
                {row.kind === 'phase' && row.item.source === 'manual' && (
                  <Stamp size="small" variant="neutral">
                    manual
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
            header: '',
            align: 'end',
            cell: (row: WorkRow) => {
              if (isRunningRow(row)) return null;
              if (row.item.done) {
                const run = row.item.run;
                if (!run) return null;
                return (
                  <div className="flex w-full justify-end [container-type:inline-size]">
                    <Stamp
                      size="small"
                      className="run-meta-stamp"
                      fillColor="var(--pui-texture-shade, rgba(0,0,0,0.06))"
                      textColor="inherit"
                    >
                      <span className="whitespace-nowrap font-mono text-3xs font-normal opacity-[0.7]">
                        <span className="run-meta-tokens">
                          {formatTokens(run.inputTokens + run.outputTokens)} tokens{' '}
                        </span>
                        <span className="run-meta-tokens">· </span>
                        <span className="run-meta-duration">
                          {formatDuration(run.durationMs)}
                          {run.attempts > 1 && ` ×${run.attempts}`}
                        </span>
                        {run.model && <span className="run-meta-duration"> · </span>}
                        {run.model && <span>{run.model}</span>}
                      </span>
                    </Stamp>
                  </div>
                );
              }
              if (row.kind !== 'phase') return null;
              return (
                <div className="flex justify-end">
                  <AgentStartButton planId={plan.id} phaseIndex={row.index} disabled={agentBusy} />
                </div>
              );
            },
          },
        ]}
        expandable={{
          render: (row: WorkRow) => {
            const runSummary = row.item.run ? formatRunSummary(row.item.run) : null;
            if (!row.item.description && !runSummary) return null;
            return (
              <div className="flex flex-col gap-1">
                {row.item.description && <span>{row.item.description}</span>}
                {runSummary && (
                  <span className="font-mono text-3xs opacity-[0.7]">{runSummary}</span>
                )}
              </div>
            );
          },
        }}
        hideHeader
        density="compact"
        showExpandColumn={false}
        rowTexture={(row: WorkRow) => {
          if (row.kind === 'fix') return 'kraft';
          if (row.kind === 'phase' && row.item.done) return 'canvas';
          return undefined;
        }}
        rowClassName={(row: WorkRow) => {
          if (isRunningRow(row)) return 'phase-running-row';
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
  if (!showBranchRow) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap mb-3 min-h-8">
      {showBranchRow && !onOwnBranch && (
        <Card size="small" accent accentColor="amber" texture="kraft">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs">
              <code>{gitBranch ?? 'unknown'}</code> — not this plan's branch.
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
        <Card size="small" texture="paper">
          <span className="text-xs opacity-[0.6]">
            <code>{gitBranch}</code>
          </span>
        </Card>
      )}
    </div>
  );
};

const PlanProgressRow = ({
  progress,
  color: barColor,
  rollup,
}: {
  progress: { pct: number; done: number; total: number } | null;
  color: string;
  rollup: UsageRollup;
}) => {
  if (progress === null && rollup.runs === 0) return null;
  return (
    <div className="flex items-center gap-3 mb-3 flex-wrap">
      {progress !== null && (
        <>
          <div className="flex-1 min-w-24">
            <ProgressBar pct={progress.pct} color={barColor} />
          </div>
          <span className="text-sm opacity-50 flex-shrink-0">{Math.round(progress.pct)}%</span>
        </>
      )}
      <RunCostSummary rollup={rollup} />
    </div>
  );
};

const PlanBodySection = ({ plan }: { plan: PlanEntry }) => {
  const [expanded, setExpanded] = useState(false);
  // Collapse again when the active plan changes, instead of carrying an open
  // description over onto a different idea.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the id/title pair is the reset trigger, not read
  useEffect(() => setExpanded(false), [plan.id, plan.title]);
  if (!plan.body) return null;
  return (
    <div className="mb-4">
      <Accordion
        title={<span className={sectionHeadingClass}>Description</span>}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      >
        <div className="opacity-[0.85]">
          <Markdown>{plan.body}</Markdown>
        </div>
      </Accordion>
    </div>
  );
};

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

// Always rendered as the Phases table's panelFooter — never hidden, so the
// panel reads as a persistent Deliver station rather than something that
// pops in only once there happens to be a change to commit.
const DeliverSection = ({ plan }: { plan: PlanEntry }) => {
  const gitStatus = useAppStore((s) => s.gitStatus);
  const files = useMemo(
    () => gitStatus?.map((entry) => ({ path: entry.path, staged: entry.staged })) ?? [],
    [gitStatus],
  );
  const commitForm = useDeliverCommitForm(plan, files);
  const hasChanges = files.length > 0;
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-x-6">
      <div className="flex flex-1 flex-col gap-2">
        <DeliverChecksRow />
        {hasChanges && <CommitMessageFields state={commitForm} filesEmpty={!hasChanges} />}
      </div>
      <Divider orientation="vertical" className="hidden md:block" />
      <div className="flex flex-col gap-2">
        {hasChanges ? (
          <>
            <DeliverChangedFiles count={files.length} />
            <DeliverCommitButton state={commitForm} filesEmpty={!hasChanges} />
          </>
        ) : (
          <DeliverEmptyState />
        )}
      </div>
    </div>
  );
};

const TrailSection = ({
  planId,
  released,
  reviewing,
  reviewNote,
}: {
  planId: string | undefined;
  released?: string;
  reviewing?: boolean;
  reviewNote?: string;
}) => {
  const trail = useTrail(planId);
  if (!planId) return null;
  return (
    <div className="mb-3 text-xs opacity-80">
      {trail ? (
        <ProvenanceTrailPanel
          trail={trail}
          released={released}
          reviewing={reviewing}
          reviewNote={reviewNote}
        />
      ) : (
        // Reserves the real row's height (4 small stamps + arrows) so the
        // trail fetch resolving doesn't push the header content below it
        // down once it lands — most visible now that History sits right
        // under the title instead of at the page's bottom.
        <div className="max-w-xs" aria-hidden="true">
          <Skeleton variant="text" height={32} />
        </div>
      )}
    </div>
  );
};

function feedbackDraftKeyFor(plan: PlanEntry): string {
  return `feedback-draft:${plan.id ?? plan.title}`;
}

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
  const [pending, setPending] = useState<string | null>(null);
  const [ideaPromptIndex, setIdeaPromptIndex] = useState<number | null>(null);
  const thread = plan.thread ?? [];
  const { promotingIndex, promoteToDurable, promoteToIdea } = usePromoteThreadMessage(plan);
  useFeedbackQuietSummary(plan, true);

  const draftKey = feedbackDraftKeyFor(plan);

  useEffect(() => {
    setInput(readLocalDraft<string>(draftKey) ?? '');
  }, [draftKey]);

  useEffect(() => {
    if (!input) return;
    writeLocalDraft(draftKey, input);
  }, [draftKey, input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setPending(text);
    setInput('');
    if (await onSend(text)) {
      removeLocalDraft(draftKey);
    } else {
      setInput((current) => current || text);
    }
    setPending(null);
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
          {thread.length > 0 || pending ? (
            <>
              <FeedbackThread
                messages={thread}
                undo={undo}
                undoing={undoing}
                onUndo={onUndo}
                onPromote={handlePromote}
                promotingIndex={promotingIndex}
              />
              {pending && (
                <div className="flex flex-col gap-1 items-end">
                  <div className="max-w-[85%]">
                    <Card
                      size="small"
                      surface="paper"
                      texture="parchment"
                      accent
                      accentColor="blue"
                    >
                      {pending}
                    </Card>
                  </div>
                </div>
              )}
              {updating && (
                <div className="flex flex-col gap-1 items-start">
                  <Card size="small" surface="paper" texture="kraft" shade>
                    <Spinner size="small" label="Agent thinking…" />
                  </Card>
                </div>
              )}
            </>
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
          />
          <div className="flex justify-end items-center gap-3">
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
  const reviewing = Boolean(runningPrReviewForPlan(plan.id, agentStatus));
  const reviewNote = latestReviewNote(plan.thread);
  const runningFill = useRunningPhaseFill(planTask, taskLog);
  const usageRollup = useMemo(() => rollupUsage(taskLog, plan.id), [taskLog, plan.id]);
  const auditRunning = planTask?.taskKind === 'audit';
  const progress = rollupProgress(plan, runningFill?.fraction ?? 0);
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
      const { branch, warning } = await createPlanBranch(plan.id);
      toast({ title: 'Branch ready', description: `Now on ${branch}`, variant: 'success' });
      if (warning) toast({ title: 'Stale fork', description: warning, variant: 'warning' });
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
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
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

      <TrailSection
        planId={plan.id}
        released={plan.released}
        reviewing={reviewing}
        reviewNote={reviewNote}
      />

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

          <PlanProgressRow
            progress={progress}
            color={STATUS_COLOR[effectiveStatus(plan, agentStatus)]}
            rollup={usageRollup}
          />

          <PlanBodySection plan={plan} />

          <ClarificationsSection clarifications={plan.clarifications ?? []} />

          {!hasPhases && (
            <div className="flex items-center gap-3 mb-8">
              <DraftPlanButton idea={ideaView} otherPlans={otherPlans} />
              <ExtendIdeaButton idea={ideaView} />
            </div>
          )}

          {!hasPhases && <DeliverSection plan={plan} />}

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
        </>
      )}
    </div>
  );
};
