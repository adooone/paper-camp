import { detailHeadingStyle } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { createPlanBranch } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
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
import { useState } from 'react';
import { DraftPlanButton, ExtendIdeaButton } from '../actions';
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
import { phaseProgress, relativeDate } from '../helpers';

interface EntityDetailProps {
  plan: PlanEntry;
}

/**
 * The one detail view for a work entity — idea-shaped until it has phases
 * (markdown rationale plus Draft-plan/Extend actions), plan-shaped after
 * (phases table, run controls, review actions). Notes render NoteDetail instead.
 */
/** Parses the entity id a feature branch encodes (feat/idea-43-… → IDEA-43). */
function branchEntityId(branch: string | null): string | null {
  const match = branch?.match(/^[a-z]+\/([a-z]+-\d+)-/);
  return match ? match[1].toUpperCase() : null;
}

export const EntityDetail = ({ plan }: EntityDetailProps) => {
  const allPlans = useAppStore((s) => s.plans);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const { toast } = useToast();
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
  const [branching, setBranching] = useState(false);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const agentBusy =
    agentStatus !== null && agentStatus.status !== 'done' && agentStatus.status !== 'error';
  const agentPhaseIndex =
    agentBusy && agentStatus !== null && agentStatus.planId === plan.id
      ? agentStatus.phaseIndex
      : null;
  const auditRunning =
    agentBusy &&
    agentStatus !== null &&
    agentStatus.planId === plan.id &&
    agentStatus.phaseIndex === undefined;
  const [logInput, setLogInput] = useState('');
  const progress = phaseProgress(plan);
  const hasPhases = plan.phases.length > 0;
  // The IdeaEntry view of this entity, for the idea-scoped agent actions
  // (draft/extend prompts take the idea shape).
  const ideaView: IdeaEntry = {
    id: plan.id ?? null,
    title: plan.title,
    body: plan.body,
    log: plan.log,
  };
  const otherPlans = (allPlans?.entries ?? []).filter((p) => p.id !== plan.id);
  // Branch management is manual — the app never switches branches on its own.
  // Surface where work would land, and offer the plan's branch as one click.
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
      toast({ title: 'Branch failed', description: (err as Error).message, variant: 'error' });
    } finally {
      setBranching(false);
    }
  };
  const allDone = progress !== null && progress.done === progress.total && progress.total > 0;

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

  const handleAddLogEntry = async () => {
    if (!logInput.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const newLog: LogEntry = { date: today, text: logInput.trim().replace(/\n/g, ' ') };
    const updatedLog = [...(plan.log ?? []), newLog];
    const ok = await patchByTitle(plan.title, { log: updatedLog });
    if (ok) setLogInput('');
  };

  return (
    <div>
      {/* Title on the left, updated/created on the right, same line. */}
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
        <span className="text-sm" style={{ opacity: 0.45, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {plan.updated
            ? `updated ${relativeDate(plan.updated)}`
            : `created ${relativeDate(plan.created)}`}
        </span>
      </div>

      {plan.tags.length > 0 && (
        <div style={{ display: 'flex', gap: space[2], flexWrap: 'wrap', marginBottom: space[4] }}>
          {plan.tags.map((tag) => (
            <Stamp key={tag} size="small" fillColor="rgba(0,0,0,0.06)">
              {tag}
            </Stamp>
          ))}
        </div>
      )}

      {/* Git branch + PR grouped together. */}
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

      {/* Progress bar: full width, last element of the header. */}
      {progress !== null && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: space[3], marginBottom: space[4] }}
        >
          <div style={{ flex: 1 }}>
            <ProgressBar pct={progress.pct} color={STATUS_COLOR[plan.status]} />
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
          <h3
            style={{
              fontFamily: fontFamily.serif,
              fontSize: fontSize.sm,
              fontWeight: 600,
              margin: `0 0 ${space[3]}`,
              opacity: 0.65,
            }}
          >
            Clarifications
          </h3>
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
            <h3
              style={{
                fontFamily: fontFamily.serif,
                fontSize: fontSize.sm,
                fontWeight: 600,
                margin: 0,
                opacity: 0.65,
              }}
            >
              Phases
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
              {auditRunning && <Spinner size="small" label="Audit running…" />}
              {(plan.status === 'review' || plan.status === 'done') && (
                <AuditPhasesButton plan={plan} disabled={agentBusy} />
              )}
              {plan.status !== 'done' && <ReconcileButton plan={plan} disabled={agentBusy} />}
              <AddReviewPhasesButton onAdd={handleAddReviewPhases} disabled={updating} />
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
                    onChange={() => handleTogglePhase(index)}
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
                      <Spinner size="small" label={`Agent ${agentStatus?.status}…`} />
                    ) : (
                      !phase.done && (
                        <AgentStartButton
                          planId={plan.id}
                          phaseIndex={index}
                          disabled={agentBusy}
                        />
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
      )}

      <div style={{ marginBottom: space[8] }}>
        <h3
          style={{
            fontFamily: fontFamily.serif,
            fontSize: fontSize.sm,
            fontWeight: 600,
            margin: `0 0 ${space[3]}`,
            opacity: 0.65,
          }}
        >
          Log
        </h3>
        {plan.log && plan.log.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: space[2],
              marginBottom: space[3],
            }}
          >
            {plan.log.map((entry, i) => (
              <div key={`${entry.date}-${i}`} className="text-sm" style={{ opacity: 0.75 }}>
                <span style={{ fontWeight: 600, marginRight: space[2] }}>{entry.date}</span>
                {entry.text}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: space[2], alignItems: 'flex-end' }}>
          <Textarea
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            placeholder="Add a log entry…"
            rows={2}
          />
          <Button
            variant="secondary"
            size="small"
            onClick={handleAddLogEntry}
            disabled={updating || !logInput.trim()}
          >
            Add entry
          </Button>
        </div>
      </div>
    </div>
  );
};
