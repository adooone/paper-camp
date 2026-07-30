import { detailHeadingStyle } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import { ViewDecisionModal } from '@/app/components/view-decision-modal';
import { usePlanStatusPatch, useSplitReview, useTrail } from '@/app/features/plans/hooks';
import { createPlanBranch } from '@/app/services/git-api';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type {
  AgentTaskState,
  DecisionEntry,
  IdeaEntry,
  LogEntry,
  MarginNote,
  MarginNoteAnchor,
  OpenQuestionEntry,
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
  relevantDecisions,
  runningTaskForPlan,
} from '../helpers';
import { PromoteDecisionModal, ResolveQuestionModal } from '../modals';

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
  onAddNote: (anchor: MarginNoteAnchor, prose: string) => Promise<boolean>;
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
                onAdd={(prose) => onAddNote({ kind: 'phase', index }, prose)}
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

const DecisionsSection = ({
  decisions,
  onSelect,
}: {
  decisions: DecisionEntry[];
  onSelect: (decision: DecisionEntry) => void;
}) => (
  <div style={{ marginBottom: space[5] }}>
    <h3 style={{ ...sectionHeadingStyle, margin: `0 0 ${space[3]}` }}>Decisions</h3>
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: space[3], marginBottom: space[3] }}
    >
      {decisions.map((decision) => (
        <Card key={decision.title} size="small" accent accentColor="slate" texture="kraft">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: space[3],
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[2],
                  marginBottom: space[1],
                }}
              >
                <span className="text-sm" style={{ fontWeight: 600 }}>
                  {decision.title}
                </span>
                <Stamp
                  size="small"
                  variant={decision.status === 'superseded' ? 'warning' : 'success'}
                >
                  {decision.status}
                </Stamp>
              </div>
              <div className="text-sm" style={{ opacity: 0.85 }}>
                <Markdown>{decision.body}</Markdown>
              </div>
            </div>
            <Button size="small" onClick={() => onSelect(decision)}>
              View
            </Button>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

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

const DatedEntryList = ({
  entries,
  onPromote,
}: {
  entries: LogEntry[];
  onPromote?: (entry: LogEntry) => void;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[3], marginBottom: space[4] }}>
    {entries.map((entry, i) => (
      <div
        key={`${entry.date}-${i}`}
        style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
          <span className="text-sm" style={{ fontWeight: 600, opacity: 0.5 }}>
            {entry.date}
          </span>
          {onPromote && (
            <Tooltip content="Promote this into a decision">
              <Button variant="ghost" size="small" onClick={() => onPromote(entry)}>
                Promote to decision
              </Button>
            </Tooltip>
          )}
        </div>
        <div
          className="text-sm"
          style={{
            background: 'rgba(0,0,0,0.05)',
            borderRadius: space[2],
            padding: `${space[2]} ${space[3]}`,
            alignSelf: 'flex-start',
            maxWidth: '100%',
            opacity: 0.85,
          }}
        >
          {entry.text}
        </div>
      </div>
    ))}
  </div>
);

const CommentsSection = ({
  plan,
  log,
  updating,
  onAdd,
  onPromote,
}: {
  plan: PlanEntry;
  log: LogEntry[] | undefined;
  updating: boolean;
  onAdd: (text: string) => Promise<boolean>;
  onPromote: (entry: LogEntry) => void;
}) => {
  const [logInput, setLogInput] = useState('');

  const handleAdd = async () => {
    if (!logInput.trim()) return;
    if (await onAdd(logInput.trim())) setLogInput('');
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
        <h3 style={{ ...sectionHeadingStyle, margin: 0, flex: 1 }}>Comments</h3>
        <ApplyNotesButton plan={plan} disabled={updating} />
      </div>
      <Card size="small" texture="kraft">
        {log && log.length > 0 && <DatedEntryList entries={log} onPromote={onPromote} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          <Textarea
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" onClick={handleAdd} disabled={updating || !logInput.trim()}>
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const ReviewThread = ({ entries }: { entries: LogEntry[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[3], marginBottom: space[4] }}>
    {entries.map((entry, i) => (
      <div
        key={`${entry.date}-${i}`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: space[1] }}
      >
        <div
          className="text-sm"
          style={{
            background: color.accentSlate,
            color: '#fff',
            borderRadius: space[2],
            borderBottomRightRadius: space[1],
            padding: `${space[2]} ${space[3]}`,
            maxWidth: '85%',
          }}
        >
          {entry.text}
        </div>
        <span className="text-sm" style={{ fontWeight: 600, opacity: 0.45 }}>
          You · {entry.date}
        </span>
      </div>
    ))}
  </div>
);

const PlanReviewSection = ({
  plan,
  review,
  updating,
  onAdd,
}: {
  plan: PlanEntry;
  review: LogEntry[] | undefined;
  updating: boolean;
  onAdd: (text: string) => Promise<boolean>;
}) => {
  const [input, setInput] = useState('');
  const { toast } = useToast();
  const hasEntries = review !== undefined && review.length > 0;
  const { launching, result, outcome, launch, approve, discard } = useSplitReview(plan);

  const handleAdd = async () => {
    if (!input.trim()) return;
    if (await onAdd(input.trim())) {
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
        <h3 style={{ ...sectionHeadingStyle, margin: 0, flex: 1 }}>Review</h3>
        <SplitReviewButton
          planId={plan.id}
          hasPoints={(plan.review ?? []).length > 0}
          launching={launching}
          onClick={launch}
          disabled={updating}
        />
      </div>
      <Card size="small" accent accentColor="slate" texture="kraft">
        {hasEntries ? (
          <ReviewThread entries={review} />
        ) : (
          <p className="text-sm" style={{ margin: `0 0 ${space[3]}`, color: color.textSecondary }}>
            Talk through what's wrong in your own words — then Split review turns each point into
            rework phases here or a follow-up idea.
          </p>
        )}
        <ReviewSplitMessage
          launching={launching}
          result={result}
          outcome={outcome}
          onApprove={approve}
          onDiscard={discard}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What's wrong with this plan, in your own words…"
            rows={3}
            disabled={updating}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" onClick={handleAdd} disabled={updating || !input.trim()}>
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
  const openQuestions = useAppStore((s) => s.openQuestions);
  const decisions = useAppStore((s) => s.decisions);
  const [viewingDecision, setViewingDecision] = useState<DecisionEntry | null>(null);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const { toast } = useToast();
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
  const [branching, setBranching] = useState(false);
  const [resolvingQuestion, setResolvingQuestion] = useState<OpenQuestionEntry | null>(null);
  const promoteClarification = useAppStore((s) => s.promoteClarification);
  const [promotingClarification, setPromotingClarification] = useState<number | null>(null);
  const [promotingToDecision, setPromotingToDecision] = useState<{
    source: 'comment' | 'clarification';
    entry: LogEntry;
  } | null>(null);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const agentBusy = useAppStore(selectAgentBusy);
  const detailView = useAppStore((s) => s.detailView);
  const planTask = runningTaskForPlan(plan.id, agentStatus);
  const agentPhaseIndex = planTask ? planTask.phaseIndex : null;
  const auditRunning = planTask?.taskKind === 'audit';
  const progress = phaseProgress(plan);
  const hasPhases = plan.phases.length > 0;
  const isReviewable = plan.status === 'review' || plan.status === 'done';
  const showFeedback = detailView === 'feedback' && isReviewable;
  const ideaView: IdeaEntry = {
    id: plan.id ?? null,
    title: plan.title,
    body: plan.body,
    log: plan.log,
  };
  const otherPlans = (allPlans?.entries ?? []).filter((p) => p.id !== plan.id);
  // The app never switches branches on its own; this just offers the plan's branch as one click.
  const onOwnBranch = plan.id !== undefined && branchEntityId(gitBranch) === plan.id;
  const showBranchRow =
    plan.status === 'planned' || plan.status === 'in-progress' || plan.status === 'review';

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

  const handleAddNote = async (anchor: MarginNoteAnchor, prose: string) => {
    const newNote: MarginNote = { anchor, prose, state: 'open' };
    return patchByTitle(plan.title, { notes: [...(plan.notes ?? []), newNote] });
  };

  const handlePromoteClarification = async (index: number) => {
    if (!plan.id) return;
    const entry = plan.clarifications?.[index];
    if (!entry) return;
    setPromotingClarification(index);
    try {
      await promoteClarification(plan.id, entry);
      toast({ title: 'Promoted to an open question', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Promote failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setPromotingClarification(null);
    }
  };

  const handleResolveNote = async (note: MarginNote) => {
    const nextNotes = (plan.notes ?? []).map((n) =>
      n === note ? { ...n, state: 'resolved' as const } : n,
    );
    return patchByTitle(plan.title, { notes: nextNotes });
  };

  const bodyNotes = notesForAnchor(plan.notes, { kind: 'body' });
  const blockingQuestions = openQuestions.filter(
    (q) => q.status === 'open' && q.blocks === plan.id,
  );
  const planDecisions = relevantDecisions(decisions, plan);

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
          review={plan.review}
          updating={updating}
          onAdd={handleAddReview}
        />
      ) : (
        <>
          {(showBranchRow || plan.pr) && (
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: space[3],
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="text-sm">
                      Working branch: <code>{gitBranch ?? 'unknown'}</code> — not this plan's
                      branch.
                    </span>
                    {plan.id && (
                      <Tooltip
                        content={`Creates ${(plan.kind ?? 'feat').toLowerCase()}/${plan.id.toLowerCase()}-… from main, or switches to it if it already exists`}
                      >
                        <Button size="small" onClick={handleCreateBranch} disabled={branching}>
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
          )}

          {progress !== null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                marginBottom: space[4],
              }}
            >
              <div style={{ flex: 1 }}>
                <ProgressBar
                  pct={progress.pct}
                  color={STATUS_COLOR[effectiveStatus(plan, agentStatus)]}
                />
              </div>
              <span className="text-sm" style={{ opacity: 0.5, flexShrink: 0 }}>
                {progress.done}/{progress.total}
              </span>
            </div>
          )}

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
                onAdd={(prose) => handleAddNote({ kind: 'body' }, prose)}
                disabled={updating}
              />
            </div>
            {bodyNotes.length > 0 && (
              <div style={{ marginTop: space[3] }}>
                <MarginNotesList
                  notes={bodyNotes}
                  onResolve={handleResolveNote}
                  disabled={updating}
                />
              </div>
            )}
          </div>

          {blockingQuestions.length > 0 && (
            <div style={{ marginBottom: space[5] }}>
              <h3 style={{ ...sectionHeadingStyle, margin: `0 0 ${space[3]}` }}>Open questions</h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: space[3],
                  marginBottom: space[3],
                }}
              >
                {blockingQuestions.map((question) => (
                  <Card
                    key={question.title}
                    size="small"
                    accent
                    accentColor="amber"
                    texture="kraft"
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: space[3],
                      }}
                    >
                      <div>
                        <div
                          className="text-sm"
                          style={{ fontWeight: 600, marginBottom: space[1] }}
                        >
                          {question.title}
                        </div>
                        <div className="text-sm" style={{ opacity: 0.85 }}>
                          <Markdown>{question.body}</Markdown>
                        </div>
                      </div>
                      <Button size="small" onClick={() => setResolvingQuestion(question)}>
                        Resolve
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {planDecisions.length > 0 && (
            <DecisionsSection decisions={planDecisions} onSelect={setViewingDecision} />
          )}

          {plan.clarifications && plan.clarifications.length > 0 && (
            <div style={{ marginBottom: space[5] }}>
              <h3 style={{ ...sectionHeadingStyle, margin: `0 0 ${space[3]}` }}>Clarifications</h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: space[2],
                  marginBottom: space[3],
                }}
              >
                {plan.clarifications.map((entry, i) => (
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
                    <div style={{ display: 'flex', gap: space[2], flexShrink: 0 }}>
                      <Tooltip content="Graduate this into an open question that outlives this entity">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => handlePromoteClarification(i)}
                          disabled={promotingClarification !== null}
                        >
                          {promotingClarification === i ? 'Promoting…' : 'Promote'}
                        </Button>
                      </Tooltip>
                      <Tooltip content="Promote this straight into a decision">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => setPromotingToDecision({ source: 'clarification', entry })}
                        >
                          Promote to decision
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          <CommentsSection
            plan={plan}
            log={plan.log}
            updating={updating}
            onAdd={handleAddLogEntry}
            onPromote={(entry) => setPromotingToDecision({ source: 'comment', entry })}
          />
        </>
      )}

      <ResolveQuestionModal
        question={resolvingQuestion}
        onClose={() => setResolvingQuestion(null)}
      />
      <ViewDecisionModal decision={viewingDecision} onClose={() => setViewingDecision(null)} />
      {plan.id && (
        <PromoteDecisionModal
          entityId={plan.id}
          source={promotingToDecision?.source ?? 'comment'}
          entry={promotingToDecision?.entry ?? null}
          onClose={() => setPromotingToDecision(null)}
        />
      )}
    </div>
  );
};
