import { detailHeadingStyle } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import { usePlanStatusPatch, useSplitReview, useTrail } from '@/app/features/plans/hooks';
import { createPlanBranch } from '@/app/services/git-api';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type {
  AgentTaskState,
  IdeaEntry,
  LogEntry,
  MarginNote,
  MarginNoteAnchor,
  MarginNoteKind,
  PhaseItem,
  PlanEntry,
} from '@/types/index';
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
import { useState } from 'react';
import {
  ApplyNotesButton,
  DraftPlanButton,
  ExtendIdeaButton,
  RefreshButton,
  ReworkFromNotesButton,
  SplitReviewButton,
} from '../actions';
import { ReconcileButton } from '../actions';
import {
  AddReviewPhasesButton,
  AgentStartButton,
  AuditPhasesButton,
  PhaseCopyButton,
} from '../actions';
import { AddMarginNoteButton, MarginNotesList } from '../components';
import { CollapsibleText } from '../components';
import { PlanIdStamp } from '../components';
import { ProgressBar } from '../components';
import { PrBadge, ReviewSignalBadge } from '../components';
import { ProvenanceTrailPanel } from '../components';
import { ReviewSplitMessage } from '../components';
import { STATUS_COLOR, STATUS_STAMP } from '../constants';
import {
  effectiveStatus,
  notesForAnchor,
  openMarginNotes,
  phaseProgress,
  relativeDate,
  runningTaskForPlan,
} from '../helpers';

interface EntityDetailProps {
  plan: PlanEntry;
}

/** Parses the entity id a feature branch encodes (feat/idea-43-… → IDEA-43). */
function branchEntityId(branch: string | null): string | null {
  const match = branch?.match(/^[a-z]+\/([a-z]+-\d+)-/);
  return match ? match[1].toUpperCase() : null;
}

const sectionHeadingStyle = {
  fontFamily: fontFamily.serif,
  fontSize: fontSize.sm,
  fontWeight: 600,
  opacity: 0.65,
};

const PhasesSection = ({
  plan,
  auditRunning,
  agentBusy,
  agentPhaseIndex,
  planTask,
  updating,
  onTogglePhase,
  onAddReviewPhases,
  onAddNote,
  onResolveNote,
}: {
  plan: PlanEntry;
  auditRunning: boolean;
  agentBusy: boolean;
  agentPhaseIndex: number | null | undefined;
  planTask: AgentTaskState | undefined;
  updating: boolean;
  onTogglePhase: (index: number) => void;
  onAddReviewPhases: (newPhases: PhaseItem[]) => Promise<void>;
  onAddNote: (anchor: MarginNoteAnchor, prose: string, kind?: MarginNoteKind) => Promise<boolean>;
  onResolveNote: (note: MarginNote) => Promise<boolean>;
}) => (
  <div style={{ marginBottom: space[8] }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[3],
        marginBottom: space[3],
        flexWrap: 'wrap',
      }}
    >
      <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>Phases</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
        {auditRunning && <Spinner size="small" label="Audit running…" />}
        {(plan.status === 'review' || plan.status === 'done') && <AuditPhasesButton plan={plan} />}
        {plan.status !== 'done' && <ReconcileButton plan={plan} />}
        <AddReviewPhasesButton onAdd={onAddReviewPhases} disabled={updating} />
      </div>
    </div>
    <Table
      data={plan.phases}
      columns={[
        {
          key: 'checkbox',
          header: 'Status',
          cell: (phase: PhaseItem, index: number) => (
            <Checkbox
              checked={phase.done}
              onChange={() => onTogglePhase(index)}
              disabled={updating}
            />
          ),
          width: 2,
        },
        {
          key: 'title',
          header: 'Title',
          cell: (phase: PhaseItem) => (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: space[2],
                textDecoration: phase.done ? 'line-through' : 'none',
                opacity: phase.done ? 0.45 : 1,
              }}
            >
              {phase.text}
              {phase.source === 'review' && (
                <Stamp
                  size="small"
                  fillColor={STATUS_STAMP.review.fill}
                  textColor={STATUS_STAMP.review.text}
                >
                  review
                </Stamp>
              )}
            </span>
          ),
        },
        {
          key: 'actions',
          header: 'Actions',
          cell: (phase: PhaseItem, index: number) => (
            <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
              <PhaseCopyButton planTitle={plan.title} planId={plan.id} phaseIndex={index} />
              <AddMarginNoteButton
                label="Add a note on this phase"
                onAdd={(prose, kind) => onAddNote({ kind: 'phase', index }, prose, kind)}
                disabled={updating}
              />
              {!phase.done && agentPhaseIndex === index ? (
                <Spinner size="small" label={`Agent ${planTask?.status}…`} />
              ) : (
                !phase.done && (
                  <AgentStartButton planId={plan.id} phaseIndex={index} disabled={agentBusy} />
                )
              )}
            </div>
          ),
          width: 7,
        },
      ]}
      expandable={{
        render: (phase: PhaseItem, index: number) => {
          const openNotes = notesForAnchor(plan.notes, { kind: 'phase', index });
          if (!phase.description && openNotes.length === 0) return null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
              {phase.description}
              {openNotes.length > 0 && (
                <MarginNotesList notes={openNotes} onResolve={onResolveNote} disabled={updating} />
              )}
            </div>
          );
        },
      }}
      showExpandColumn={false}
      rowClassName={(phase: PhaseItem) =>
        phase.source === 'review' ? 'phase-row-review' : undefined
      }
      className="phase-table-phone"
    />
  </div>
);

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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        flexWrap: 'wrap',
        marginBottom: space[4],
      }}
    >
      {showBranchRow && !onOwnBranch && (
        <Card size="small" accent accentColor="amber" texture="kraft">
          <div style={{ display: 'flex', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
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
        <span className="text-sm" style={{ opacity: 0.45 }}>
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
  <div style={{ display: 'flex', alignItems: 'center', gap: space[3], marginBottom: space[4] }}>
    <div style={{ flex: 1 }}>
      <ProgressBar pct={progress.pct} color={barColor} />
    </div>
    <span className="text-sm" style={{ opacity: 0.5, flexShrink: 0 }}>
      {progress.done}/{progress.total}
    </span>
  </div>
);

const PlanBodySection = ({
  plan,
  bodyNotes,
  updating,
  onAddNote,
  onResolveNote,
}: {
  plan: PlanEntry;
  bodyNotes: MarginNote[];
  updating: boolean;
  onAddNote: (anchor: MarginNoteAnchor, prose: string, kind?: MarginNoteKind) => Promise<boolean>;
  onResolveNote: (note: MarginNote) => Promise<boolean>;
}) => (
  <div style={{ marginBottom: space[4] }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: space[2] }}>
      <div style={{ flex: 1, opacity: 0.85 }}>
        {plan.body && (
          <CollapsibleText resetKey={plan.id ?? plan.title}>
            <Markdown>{plan.body}</Markdown>
          </CollapsibleText>
        )}
      </div>
      <AddMarginNoteButton
        label="Add a note on this plan's body"
        onAdd={(prose, kind) => onAddNote({ kind: 'body' }, prose, kind)}
        disabled={updating}
      />
    </div>
    {bodyNotes.length > 0 && (
      <div style={{ marginTop: space[3] }}>
        <MarginNotesList notes={bodyNotes} onResolve={onResolveNote} disabled={updating} />
      </div>
    )}
  </div>
);

const ClarificationsSection = ({ clarifications }: { clarifications: LogEntry[] }) => {
  if (clarifications.length === 0) return null;
  return (
    <div style={{ marginBottom: space[5] }}>
      <h3 style={{ ...sectionHeadingStyle, margin: `0 0 ${space[3]}` }}>Clarifications</h3>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: space[2], marginBottom: space[3] }}
      >
        {clarifications.map((entry, i) => (
          <div
            key={`clar-${entry.date}-${i}`}
            className="text-sm"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: space[3],
              opacity: 0.75,
            }}
          >
            <span>
              <span style={{ fontWeight: 600, marginRight: space[2] }}>{entry.date}</span>
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TrailSection = ({ planId }: { planId: string | undefined }) => {
  const trail = useTrail(planId);
  if (!trail) return null;
  return (
    <div style={{ marginBottom: space[8] }}>
      <h3 style={{ ...sectionHeadingStyle, margin: `0 0 ${space[3]}` }}>History</h3>
      <ProvenanceTrailPanel trail={trail} />
    </div>
  );
};

interface ThreadItem {
  date: string;
  text: string;
  kind: 'comment' | 'review';
}

/** Comments and review points are separate fields (they feed different agent
 * flows — Apply notes vs Split review) but read as one merged, date-ordered thread. */
function buildThread(log: LogEntry[] | undefined, review: LogEntry[] | undefined): ThreadItem[] {
  const comments: ThreadItem[] = (log ?? []).map((e) => ({ ...e, kind: 'comment' }));
  const reviewPoints: ThreadItem[] = (review ?? []).map((e) => ({ ...e, kind: 'review' }));
  return [...comments, ...reviewPoints].sort((a, b) => a.date.localeCompare(b.date));
}

const FeedbackThread = ({ items }: { items: ThreadItem[] }) => (
  <>
    {items.map((item, i) => (
      <div
        key={`${item.date}-${i}`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: space[1] }}
      >
        <div
          className="text-sm"
          style={{
            background: item.kind === 'review' ? color.accentSlate : 'rgba(0,0,0,0.08)',
            color: item.kind === 'review' ? '#fff' : undefined,
            borderRadius: space[2],
            borderBottomRightRadius: space[1],
            padding: `${space[2]} ${space[3]}`,
            maxWidth: '85%',
          }}
        >
          <CollapsibleText collapsedLines={3} resetKey={`${item.date}-${i}`}>
            {item.text}
          </CollapsibleText>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
          <span className="text-sm" style={{ fontWeight: 600, opacity: 0.45 }}>
            {item.date}
          </span>
          {item.kind === 'review' && (
            <Stamp size="small" fillColor="rgba(0,0,0,0.06)">
              review
            </Stamp>
          )}
        </div>
      </div>
    ))}
  </>
);

const PlanReviewSection = ({
  plan,
  updating,
  onAddComment,
  onAddReview,
}: {
  plan: PlanEntry;
  updating: boolean;
  onAddComment: (text: string) => Promise<boolean>;
  onAddReview: (text: string) => Promise<boolean>;
}) => {
  const [input, setInput] = useState('');
  const { toast } = useToast();
  const thread = buildThread(plan.log, plan.review);
  const { launching, result, outcome, launch, approve, discard } = useSplitReview(plan);

  const handleAddComment = async () => {
    if (!input.trim()) return;
    if (await onAddComment(input.trim())) setInput('');
  };

  const handleAddReview = async () => {
    if (!input.trim()) return;
    if (await onAddReview(input.trim())) {
      setInput('');
      toast({ title: 'Added to the review', variant: 'success' });
    }
  };

  return (
    <div style={{ marginBottom: space[8] }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
          margin: `0 0 ${space[3]}`,
        }}
      >
        <h3 style={{ ...sectionHeadingStyle, margin: 0, flex: 1 }}>Feedback</h3>
        <ApplyNotesButton plan={plan} disabled={updating} />
        <SplitReviewButton
          planId={plan.id}
          hasPoints={(plan.review ?? []).length > 0}
          launching={launching}
          onClick={launch}
          disabled={updating}
        />
      </div>
      <Card size="small" accent accentColor="slate" texture="kraft">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: space[3],
            marginBottom: space[4],
          }}
        >
          {thread.length > 0 ? (
            <FeedbackThread items={thread} />
          ) : (
            <p className="text-sm" style={{ margin: 0, color: color.textSecondary }}>
              Jot a comment as you work, or talk through what's wrong — then Split review turns
              review points into rework phases here or a follow-up idea.
            </p>
          )}
          <ReviewSplitMessage
            launching={launching}
            result={result}
            outcome={outcome}
            onApprove={approve}
            onDiscard={discard}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a comment, or what's wrong with this plan…"
            rows={3}
            disabled={updating}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
            <Button size="small" onClick={handleAddComment} disabled={updating || !input.trim()}>
              Add comment
            </Button>
            <Button size="small" onClick={handleAddReview} disabled={updating || !input.trim()}>
              Add review
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const EntityDetail = ({ plan }: EntityDetailProps) => {
  const allPlans = useAppStore((s) => s.plans);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const { toast } = useToast();
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
  const [branching, setBranching] = useState(false);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const agentBusy = useAppStore(selectAgentBusy);
  const detailView = useAppStore((s) => s.detailView);
  const planTask = runningTaskForPlan(plan.id, agentStatus);
  const agentPhaseIndex = planTask ? planTask.phaseIndex : null;
  const auditRunning = planTask?.taskKind === 'audit';
  const progress = phaseProgress(plan);
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

  const handleAddLogEntry = async (text: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const newLog: LogEntry = { date: today, text: text.replace(/\n/g, ' ') };
    return patchByTitle(plan.title, { log: [...(plan.log ?? []), newLog] });
  };

  const handleAddReview = async (text: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const newEntry: LogEntry = { date: today, text: text.replace(/\n/g, ' ') };
    return patchByTitle(plan.title, { review: [...(plan.review ?? []), newEntry] });
  };

  const handleAddNote = async (anchor: MarginNoteAnchor, prose: string, kind?: MarginNoteKind) => {
    const newNote: MarginNote = { anchor, prose, state: 'open', ...(kind ? { kind } : {}) };
    return patchByTitle(plan.title, { notes: [...(plan.notes ?? []), newNote] });
  };

  const handleResolveNote = async (note: MarginNote) => {
    const nextNotes = (plan.notes ?? []).map((n) =>
      n === note ? { ...n, state: 'resolved' as const } : n,
    );
    return patchByTitle(plan.title, { notes: nextNotes });
  };

  const bodyNotes = notesForAnchor(plan.notes, { kind: 'body' });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space[3],
          margin: `0 0 ${space[3]}`,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            ...detailHeadingStyle,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: space[3],
            minWidth: 0,
            flexWrap: 'wrap',
          }}
        >
          <PlanIdStamp id={plan.id} />
          {plan.title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexShrink: 0 }}>
          <span className="text-sm" style={{ opacity: 0.45, whiteSpace: 'nowrap' }}>
            {plan.updated
              ? `updated ${relativeDate(plan.updated)}`
              : `created ${relativeDate(plan.created)}`}
          </span>
          {openMarginNotes(plan.notes).length > 0 && (
            <ReworkFromNotesButton plan={plan} disabled={updating} />
          )}
          <RefreshButton />
        </div>
      </div>

      {showFeedback ? (
        <PlanReviewSection
          plan={plan}
          updating={updating}
          onAddComment={handleAddLogEntry}
          onAddReview={handleAddReview}
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

          <PlanBodySection
            plan={plan}
            bodyNotes={bodyNotes}
            updating={updating}
            onAddNote={handleAddNote}
            onResolveNote={handleResolveNote}
          />

          <ClarificationsSection clarifications={plan.clarifications ?? []} />

          {!hasPhases && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                marginBottom: space[8],
              }}
            >
              <DraftPlanButton idea={ideaView} otherPlans={otherPlans} />
              <ExtendIdeaButton idea={ideaView} />
            </div>
          )}

          {hasPhases && (
            <PhasesSection
              plan={plan}
              auditRunning={auditRunning}
              agentBusy={agentBusy}
              agentPhaseIndex={agentPhaseIndex}
              planTask={planTask}
              updating={updating}
              onTogglePhase={handleTogglePhase}
              onAddReviewPhases={handleAddReviewPhases}
              onAddNote={handleAddNote}
              onResolveNote={handleResolveNote}
            />
          )}

          <TrailSection planId={plan.id} />
        </>
      )}
    </div>
  );
};
