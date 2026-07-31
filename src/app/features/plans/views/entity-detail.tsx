import { detailHeadingStyle } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import { usePlanStatusPatch, useSendFeedbackMessage, useTrail } from '@/app/features/plans/hooks';
import { createPlanBranch } from '@/app/services/git-api';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type {
  AgentTaskState,
  IdeaEntry,
  LogEntry,
  PhaseItem,
  PlanEntry,
  ThreadMessage,
  ThreadMessageKind,
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
import { DraftPlanButton, ExtendIdeaButton, RefreshButton } from '../actions';
import { ReconcileButton } from '../actions';
import {
  AddReviewPhasesButton,
  AgentStartButton,
  AuditPhasesButton,
  PhaseCopyButton,
} from '../actions';
import { CollapsibleText } from '../components';
import { PlanIdStamp } from '../components';
import { ProgressBar } from '../components';
import { PrBadge, ReviewSignalBadge } from '../components';
import { ProvenanceTrailPanel } from '../components';
import { STATUS_COLOR, STATUS_STAMP } from '../constants';
import {
  effectiveStatus,
  fixProgress,
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
}: {
  plan: PlanEntry;
  auditRunning: boolean;
  agentBusy: boolean;
  agentPhaseIndex: number | null | undefined;
  planTask: AgentTaskState | undefined;
  updating: boolean;
  onTogglePhase: (index: number) => void;
  onAddReviewPhases: (newPhases: PhaseItem[]) => Promise<void>;
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
        render: (phase: PhaseItem) => phase.description || null,
      }}
      showExpandColumn={false}
      rowClassName={(phase: PhaseItem) =>
        phase.source === 'review' ? 'phase-row-review' : undefined
      }
      className="phase-table-phone"
    />
  </div>
);

const FixesSection = ({
  plan,
  updating,
  onToggleFix,
}: {
  plan: PlanEntry;
  updating: boolean;
  onToggleFix: (index: number) => void;
}) => {
  const fixes = plan.fixes ?? [];
  const progress = fixProgress(plan);
  return (
    <div style={{ marginBottom: space[8] }}>
      <h3 style={{ ...sectionHeadingStyle, margin: `0 0 ${space[3]}` }}>Fixes</h3>
      <Card size="small" accent accentColor="rose" texture="canvas">
        {progress && (
          <div style={{ marginBottom: space[3] }}>
            <PlanProgressBar progress={progress} color={STATUS_STAMP.review.text} />
          </div>
        )}
        <Table
          data={fixes}
          columns={[
            {
              key: 'checkbox',
              header: 'Status',
              cell: (fix: PhaseItem, index: number) => (
                <Checkbox
                  checked={fix.done}
                  onChange={() => onToggleFix(index)}
                  disabled={updating}
                />
              ),
              width: 2,
            },
            {
              key: 'title',
              header: 'Title',
              cell: (fix: PhaseItem) => (
                <span
                  style={{
                    textDecoration: fix.done ? 'line-through' : 'none',
                    opacity: fix.done ? 0.45 : 1,
                  }}
                >
                  {fix.text}
                </span>
              ),
            },
          ]}
          expandable={{
            render: (fix: PhaseItem) => fix.description || null,
          }}
          showExpandColumn={false}
          className="phase-table-phone"
        />
      </Card>
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

const PlanBodySection = ({ plan }: { plan: PlanEntry }) => (
  <div style={{ marginBottom: space[4] }}>
    <div style={{ opacity: 0.85 }}>
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

const THREAD_KIND_LABEL: Partial<Record<ThreadMessageKind, string>> = {
  review: 'review',
  note: 'note',
  decision: 'decision',
  question: 'question',
  clarification: 'clarification',
};

const FeedbackThread = ({
  messages,
  undo,
  undoing,
  onUndo,
}: {
  messages: ThreadMessage[];
  undo: { commitSha: string } | null;
  undoing: boolean;
  onUndo: () => void;
}) => (
  <>
    {messages.map((message, i) => {
      const label = THREAD_KIND_LABEL[message.kind];
      const fromAgent = message.from === 'agent';
      const isLast = i === messages.length - 1;
      return (
        <div
          key={`${message.kind}-${message.date ?? ''}-${i}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: fromAgent ? 'flex-start' : 'flex-end',
            gap: space[1],
          }}
        >
          <div style={{ maxWidth: '85%' }}>
            <Card
              size="small"
              surface={fromAgent ? 'chalkboard' : 'paper'}
              texture={fromAgent ? undefined : label ? 'canvas' : 'parchment'}
              accent={!fromAgent}
              accentColor={label ? 'rose' : 'blue'}
            >
              <CollapsibleText
                collapsedLines={3}
                resetKey={`${message.kind}-${message.date ?? ''}-${i}`}
              >
                {message.text}
              </CollapsibleText>
            </Card>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
            {fromAgent && (
              <Stamp size="small" fillColor="rgba(0,0,0,0.06)">
                agent
              </Stamp>
            )}
            {fromAgent && isLast && undo && (
              <Tooltip content="Revert this run's plan edit">
                <Button size="small" variant="ghost" onClick={onUndo} disabled={undoing}>
                  {undoing ? 'Undoing…' : 'Undo'}
                </Button>
              </Tooltip>
            )}
            {message.date && (
              <span className="text-sm" style={{ fontWeight: 600, opacity: 0.45 }}>
                {message.date}
              </span>
            )}
            {label && (
              <Stamp size="small" fillColor="rgba(0,0,0,0.06)">
                {label}
              </Stamp>
            )}
          </div>
        </div>
      );
    })}
  </>
);

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
  const thread = plan.thread ?? [];

  const handleSend = async () => {
    if (!input.trim()) return;
    if (await onSend(input.trim())) setInput('');
  };

  return (
    <div style={{ marginBottom: space[8] }}>
      <h3 style={{ ...sectionHeadingStyle, margin: `0 0 ${space[3]}` }}>Feedback</h3>
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
            <FeedbackThread messages={thread} undo={undo} undoing={undoing} onUndo={onUndo} />
          ) : (
            <p className="text-sm" style={{ margin: 0, color: color.textSecondary }}>
              Jot a comment, ask a question, or say what's wrong with this plan.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Feedback message"
            placeholder="Write a message…"
            rows={3}
            disabled={updating}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: space[3],
            }}
          >
            <span style={{ visibility: updating ? 'visible' : 'hidden' }}>
              <Spinner size="small" label="Agent replying…" />
            </span>
            <Button size="small" onClick={handleSend} disabled={updating || !input.trim()}>
              Send
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
  const hasFixes = (plan.fixes ?? []).length > 0;
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
  } = useSendFeedbackMessage(plan);

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
            />
          )}

          {hasFixes && (
            <FixesSection plan={plan} updating={updating} onToggleFix={handleToggleFix} />
          )}

          <TrailSection planId={plan.id} />
        </>
      )}
    </div>
  );
};
