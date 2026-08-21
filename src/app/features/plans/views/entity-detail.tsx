import { CommitMessageFields } from '@/app/components';
import { detailHeadingClassName } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import {
  usePlanStatusPatch,
  useRunningPhaseFill,
  useSendFeedbackMessage,
  useTrail,
} from '@/app/features/plans/hooks';
import { entityRouteParam } from '@/app/hooks';
import { createTicket } from '@/app/services/content';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { type UsageRollup, formatDuration, formatTokens, rollupUsage } from '@/core/phase-run';
import type { IdeaEntry, LogEntry, PhaseItem, PlanEntry } from '@/types/index';
import { Skeleton, Stamp, Tooltip, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { RefreshButton } from '../actions';
import { AddTicketButton } from '../actions';
import {
  DeliverChangedFiles,
  DeliverChecksRow,
  DeliverCommitButton,
  DeliverEmptyState,
  useDeliverCommitForm,
} from '../components';
import { PlanIdStamp } from '../components';
import { ProgressBar } from '../components';
import { ProvenanceTrailPanel } from '../components';
import { STATUS_COLOR, STATUS_LABEL, STATUS_STAMP } from '../constants';
import {
  effectiveStatus,
  latestReviewNote,
  relativeDate,
  rollupProgress,
  runningPrReviewForPlan,
  runningTaskForPlan,
} from '../helpers';
import { FeedbackSection } from './feedback-section';
import { PhasesSection } from './phases-section';
import { PlanRows } from './plan-rows';

interface EntityDetailProps {
  plan: PlanEntry;
}

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

// Same stamp as a phase row's run cost, and the same three-item shape — the
// rollup swaps the phase's single model for a run count.
const RunCostSummary = ({ rollup }: { rollup: UsageRollup }) => {
  if (rollup.runs === 0) return null;
  return (
    // shrink-0: the stamp sets its own width from nowrap text, so letting flex
    // squeeze it just pushes the text past the sheet's edge.
    <span className="shrink-0">
      <Tooltip
        content={`${formatTokens(rollup.inputTokens)} in · ${formatTokens(rollup.outputTokens)} out · cache ${formatTokens(rollup.cacheCreationTokens)} write · ${formatTokens(rollup.cacheReadTokens)} read`}
      >
        <Stamp size="small" fillColor="var(--pui-texture-shade)" textColor="inherit">
          <span className="whitespace-nowrap font-mono text-3xs font-normal opacity-[0.7]">
            {formatTokens(rollup.inputTokens + rollup.outputTokens)} tokens ·{' '}
            {formatDuration(rollup.durationMs)} · {rollup.runs} {rollup.runs === 1 ? 'run' : 'runs'}
          </span>
        </Stamp>
      </Tooltip>
    </span>
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
    // min-w-min, not a fixed rem: the cost stamp's width depends on its numbers, so
    // only min-content knows when the bar has hit its floor and the strip must wrap.
    // A guessed rem value either wraps too eagerly or lets the stamp overflow.
    <div className="flex items-center gap-3 flex-1 min-w-min">
      {progress !== null && (
        <>
          <div className="flex-1 min-w-16">
            <ProgressBar pct={progress.pct} color={barColor} />
          </div>
          <span className="text-sm opacity-50 flex-shrink-0 font-handwritten">
            {Math.round(progress.pct)}%
          </span>
        </>
      )}
      <RunCostSummary rollup={rollup} />
    </div>
  );
};

const PlanBodySection = ({ plan }: { plan: PlanEntry }) => {
  if (!plan.body) return null;
  return (
    <div className="mb-4">
      <h3 className={`${sectionHeadingClass} mb-2`}>Description</h3>
      <div className="opacity-[0.85]">
        <Markdown>{plan.body}</Markdown>
      </div>
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

/** Only a fix entity carries `idea:` — its parent, linked, so the context that
 * produced it is one click away (IDEA-187). */
const ParentLinkRow = ({ plan, otherPlans }: { plan: PlanEntry; otherPlans: PlanEntry[] }) => {
  const navigate = useNavigate();
  const isTicket = plan.entityKind === 'ticket';
  if ((!isTicket && plan.entityKind !== 'fix') || !plan.idea) return null;
  const parentId = plan.idea;
  const parent = otherPlans.find((p) => p.id === parentId);
  return (
    <div className="mb-3">
      {/* Raw <button>: a chromeless click target wrapping a stamp + label, not a paper-ui Button. */}
      <button
        type="button"
        onClick={() =>
          navigate({
            to: '/plans/$planId',
            params: { planId: entityRouteParam(parentId, parent?.title ?? parentId) },
          })
        }
        className="flex items-center gap-2 bg-none bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
      >
        <Stamp size="small" variant={isTicket ? 'info' : 'warning'}>
          {isTicket ? 'ticket' : 'fix'}
        </Stamp>
        <span className="text-sm opacity-70">
          {isTicket ? 'On board' : 'Fixes'} <span className="font-mono">{parentId}</span>
          {parent && ` — ${parent.title}`}
        </span>
      </button>
    </div>
  );
};

/** Every linked fix entity with its status — the parent stays archived and
 * read-only, but it knows what came after it (IDEA-187). */
const FixesSection = ({ plan, otherPlans }: { plan: PlanEntry; otherPlans: PlanEntry[] }) => {
  const navigate = useNavigate();
  const fixes = otherPlans.filter((p) => p.entityKind === 'fix' && p.idea === plan.id);
  if (fixes.length === 0) return null;
  return (
    <div className="mb-5">
      <h3 className={`${sectionHeadingClass} mb-3`}>Fixes</h3>
      <div className="flex flex-col gap-2 mb-3">
        {fixes.map((fix) => (
          <button
            key={fix.title}
            type="button"
            onClick={() =>
              navigate({
                to: '/plans/$planId',
                params: { planId: entityRouteParam(fix.id, fix.title) },
              })
            }
            className="flex items-center gap-2 bg-none bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left text-sm"
          >
            <PlanIdStamp id={fix.id} />
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {fix.title}
            </span>
            <Stamp
              size="small"
              fillColor={STATUS_STAMP[fix.status].fill}
              textColor={STATUS_STAMP[fix.status].text}
            >
              {STATUS_LABEL[fix.status]}
            </Stamp>
          </button>
        ))}
      </div>
    </div>
  );
};

/** A board's decomposition, in the same row treatment the main worklist uses
 * (IDEA-201) — never the phases Table, since a board carries no phases of its own.
 * Adding a ticket stays on this view: it posts straight to the board's own list
 * and reloads, rather than navigating to a separate creation flow. */
const TicketsSection = ({ plan, otherPlans }: { plan: PlanEntry; otherPlans: PlanEntry[] }) => {
  const navigate = useNavigate();
  const loadPlans = useAppStore((s) => s.loadPlans);
  const tickets = otherPlans.filter((p) => p.entityKind === 'ticket' && p.idea === plan.id);
  const handleOpen = (title: string) => {
    const ticket = tickets.find((t) => t.title === title);
    if (!ticket) return;
    navigate({
      to: '/plans/$planId',
      params: { planId: entityRouteParam(ticket.id, ticket.title) },
    });
  };
  const handleAddTicket = async (title: string) => {
    if (!plan.id) return;
    await createTicket({ boardId: plan.id, title });
    await loadPlans();
  };
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${sectionHeadingClass} m-0`}>Tickets</h3>
        <AddTicketButton onAdd={handleAddTicket} disabled={!plan.id} />
      </div>
      {tickets.length > 0 ? (
        <PlanRows plans={tickets} onOpen={handleOpen} />
      ) : (
        <p className="text-sm m-0 opacity-50">
          No tickets yet — add one to start the decomposition.
        </p>
      )}
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
    // One centred column in both states. min-h keeps the footer from resizing as it
    // switches between them.
    <div className="flex min-h-[7rem] flex-col items-center justify-center gap-3">
      <DeliverChecksRow />
      {hasChanges ? (
        <>
          {/* Bounded width: the commit input would otherwise stretch the full sheet
              and stop reading as one centred group with the row below it. */}
          <div className="w-full max-w-md">
            <CommitMessageFields state={commitForm} filesEmpty={false} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <DeliverChangedFiles count={files.length} />
            <DeliverCommitButton state={commitForm} filesEmpty={false} />
          </div>
        </>
      ) : (
        <DeliverEmptyState />
      )}
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
    <div className="text-xs opacity-80 shrink-0">
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

export const EntityDetail = ({ plan }: EntityDetailProps) => {
  const allPlans = useAppStore((s) => s.plans);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const { toast } = useToast();
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
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

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

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
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className={`${detailHeadingClassName} m-0 flex items-center gap-3 min-w-0 flex-wrap`}>
          <PlanIdStamp id={plan.id} />
          {plan.title}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0 font-handwritten">
          <span className="text-sm opacity-[0.45] whitespace-nowrap">
            <span className="max-[480px]:hidden">{plan.updated ? 'updated ' : 'created '}</span>
            {relativeDate(plan.updated ?? plan.created)}
          </span>
          <RefreshButton />
        </div>
      </div>

      <ParentLinkRow plan={plan} otherPlans={otherPlans} />

      {/* One strip: pipeline position, progress and cost all answer "where is this
          and what has it cost", and each was claiming a full-width band of its own.
          Wraps back to stacked rows when the column is too narrow to hold them. */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mb-3">
        <TrailSection
          planId={plan.id}
          released={plan.released}
          reviewing={reviewing}
          reviewNote={reviewNote}
        />
        {!showFeedback && (
          <PlanProgressRow
            progress={progress}
            color={STATUS_COLOR[effectiveStatus(plan, agentStatus)]}
            rollup={usageRollup}
          />
        )}
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
          {plan.entityKind === 'board' ? (
            <TicketsSection plan={plan} otherPlans={otherPlans} />
          ) : (
            <PhasesSection
              plan={plan}
              auditRunning={auditRunning}
              agentBusy={agentBusy}
              runningFill={runningFill}
              updating={updating}
              onTogglePhase={handleTogglePhase}
              onToggleFix={handleToggleFix}
              onAddReviewPhases={handleAddReviewPhases}
              ideaView={ideaView}
              otherPlans={otherPlans}
              deliverPanel={<DeliverSection plan={plan} />}
            />
          )}

          <FixesSection plan={plan} otherPlans={otherPlans} />

          <ClarificationsSection clarifications={plan.clarifications ?? []} />

          <PlanBodySection plan={plan} />
        </>
      )}
    </div>
  );
};
