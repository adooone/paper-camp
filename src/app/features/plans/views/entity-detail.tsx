import { detailHeadingStyle } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { createPlanBranch } from '@/app/services/git-api';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { AgentTaskState, IdeaEntry, LogEntry, PhaseItem, PlanEntry } from '@/types/index';
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
import { STATUS_COLOR, STATUS_STAMP } from '../constants';
import { effectiveStatus, phaseProgress, relativeDate, runningTaskForPlan } from '../helpers';

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
      }}
    >
      <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>Phases</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
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
          width: 5,
        },
      ]}
      expandable={{
        render: (phase: PhaseItem) => phase.description ?? null,
      }}
      showExpandColumn={false}
      rowClassName={(phase: PhaseItem) =>
        phase.source === 'review' ? 'phase-row-review' : undefined
      }
    />
  </div>
);

const CommentsSection = ({
  log,
  updating,
  onAdd,
}: {
  log: LogEntry[] | undefined;
  updating: boolean;
  onAdd: (text: string) => Promise<boolean>;
}) => {
  const [logInput, setLogInput] = useState('');

  const handleAdd = async () => {
    if (!logInput.trim()) return;
    if (await onAdd(logInput.trim())) setLogInput('');
  };

  return (
    <div style={{ marginBottom: space[8] }}>
      <h3 style={{ ...sectionHeadingStyle, margin: `0 0 ${space[3]}` }}>Comments</h3>
      <Card size="small">
        {log && log.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: space[3],
              marginBottom: space[4],
            }}
          >
            {log.map((entry, i) => (
              <div
                key={`${entry.date}-${i}`}
                style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}
              >
                <span className="text-sm" style={{ fontWeight: 600, opacity: 0.5 }}>
                  {entry.date}
                </span>
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
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          <Textarea
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              size="small"
              onClick={handleAdd}
              disabled={updating || !logInput.trim()}
            >
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
  const planTask = runningTaskForPlan(plan.id, agentStatus);
  const agentPhaseIndex = planTask ? planTask.phaseIndex : null;
  const auditRunning = planTask?.taskKind === 'audit';
  const progress = phaseProgress(plan);
  const hasPhases = plan.phases.length > 0;
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

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space[3],
          margin: `0 0 ${space[3]}`,
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
            <Card size="small" accent accentColor="amber">
              <div
                style={{ display: 'flex', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}
              >
                <span className="text-sm">
                  Working branch: <code>{gitBranch ?? 'unknown'}</code> — not this plan's branch.
                </span>
                {plan.id && (
                  <Tooltip
                    content={`Creates ${(plan.kind ?? 'feat').toLowerCase()}/${plan.id.toLowerCase()}-… from main, or switches to it if it already exists`}
                  >
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={handleCreateBranch}
                      disabled={branching}
                    >
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
          style={{ display: 'flex', alignItems: 'center', gap: space[3], marginBottom: space[4] }}
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

      {plan.body && (
        <div style={{ marginBottom: space[4], opacity: 0.85 }}>
          <CollapsibleText resetKey={plan.id ?? plan.title}>
            <Markdown>{plan.body}</Markdown>
          </CollapsibleText>
        </div>
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
              <div key={`clar-${entry.date}-${i}`} className="text-sm" style={{ opacity: 0.75 }}>
                <span style={{ fontWeight: 600, marginRight: space[2] }}>{entry.date}</span>
                {entry.text}
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
        />
      )}

      <CommentsSection log={plan.log} updating={updating} onAdd={handleAddLogEntry} />
    </div>
  );
};
