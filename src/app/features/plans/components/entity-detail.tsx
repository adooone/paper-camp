import { Markdown } from '@/app/components/markdown';
import { updatePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import {
  AGENT_IDS,
  AGENT_LABELS,
  type AgentId,
  type IdeaEntry,
  type LogEntry,
  PLAN_STATUSES,
  type PhaseItem,
  type PlanEntry,
  type PlanStatus,
} from '@/types/index';
import { Button, Checkbox, Select, Spinner, Stamp, Table, Textarea } from '@dendelion/paper-ui';
import { useState } from 'react';
import { STATUS_COLOR, STATUS_LABEL } from '../constants';
import { phaseProgress, relativeDate } from '../helpers';
import { AddReviewPhasesButton } from './add-review-phases-button';
import { AgentStartButton } from './agent-start-button';
import { AuditPhasesButton } from './audit-phases-button';
import { ClarifyButton } from './clarify-button';
import { DraftPlanButton } from './draft-plan-button';
import { ExtendIdeaButton } from './extend-idea-button';
import { PhaseCopyButton } from './phase-copy-button';
import { PlanIdStamp } from './plan-id-stamp';
import { ProgressBar } from './progress-bar';
import { ReconcileButton } from './reconcile-button';
import { ReconcileDiffPanel } from './reconcile-diff-panel';
import { RunAllPhasesButton } from './run-all-phases-button';

interface EntityDetailProps {
  plan: PlanEntry;
}

/**
 * The one detail view for a work entity — idea-shaped until it has phases
 * (markdown rationale plus Draft-plan/Extend actions), plan-shaped after
 * (phases table, run controls, review actions). Notes render NoteDetail instead.
 */
export const EntityDetail = ({ plan }: EntityDetailProps) => {
  const loadPlans = useAppStore((s) => s.loadPlans);
  const allPlans = useAppStore((s) => s.plans);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const reconcilePreview = useAppStore((s) => s.reconcilePreview);
  const setReconcilePreview = useAppStore((s) => s.setReconcilePreview);
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
  const [updating, setUpdating] = useState(false);
  const [logInput, setLogInput] = useState('');
  const progress = phaseProgress(plan);
  const hasPhases = plan.phases.length > 0;
  const inProgress = plan.status === 'in-progress';
  const underReview = plan.status === 'review';
  // The IdeaEntry view of this entity, for the idea-scoped agent actions
  // (draft/extend prompts take the idea shape).
  const ideaView: IdeaEntry = {
    id: plan.id ?? null,
    title: plan.title,
    body: plan.body,
    log: plan.log,
  };
  const otherPlans = (allPlans?.entries ?? []).filter((p) => p.id !== plan.id);
  const allDone = progress !== null && progress.done === progress.total && progress.total > 0;

  const handleStart = async () => {
    setUpdating(true);
    await updatePlan(plan.title, { status: 'in-progress' });
    await loadPlans();
    setUpdating(false);
  };

  const handleStop = async () => {
    setUpdating(true);
    await updatePlan(plan.title, { status: 'planned' });
    await loadPlans();
    setUpdating(false);
  };

  const handleTogglePhase = async (index: number) => {
    const nextPhases: PhaseItem[] = plan.phases.map((phase, i) =>
      i === index ? { ...phase, done: !phase.done } : phase,
    );
    setUpdating(true);
    const allChecked = nextPhases.every((p) => p.done);
    // Auto-set to review when last phase is checked
    if (allChecked && plan.status === 'in-progress') {
      await updatePlan(plan.title, { phases: nextPhases, status: 'review' });
    } else {
      await updatePlan(plan.title, { phases: nextPhases });
    }
    await loadPlans();
    setUpdating(false);
  };

  const handleApprove = async () => {
    setUpdating(true);
    await updatePlan(plan.title, { status: 'done' });
    await loadPlans();
    setUpdating(false);
  };

  const handleNeedsChanges = async () => {
    setUpdating(true);
    await updatePlan(plan.title, { status: 'in-progress' });
    await loadPlans();
    setUpdating(false);
  };

  const handleSetStatus = async (value: string) => {
    setUpdating(true);
    await updatePlan(plan.title, { status: value as PlanStatus });
    await loadPlans();
    setUpdating(false);
  };

  const handleSetAgent = async (value: string) => {
    setUpdating(true);
    await updatePlan(plan.title, { agent: value ? (value as AgentId) : null });
    await loadPlans();
    setUpdating(false);
  };

  const handleAddReviewPhases = async (newPhases: PhaseItem[]) => {
    setUpdating(true);
    await updatePlan(plan.title, { phases: [...plan.phases, ...newPhases] });
    await loadPlans();
    setUpdating(false);
  };

  const handleApproveReconcile = () => {
    setReconcilePreview(null);
  };

  const handleDiscardReconcile = async () => {
    if (!reconcilePreview || reconcilePreview.planId !== plan.id) return;
    setUpdating(true);
    await updatePlan(plan.title, {
      body: reconcilePreview.before.body,
      phases: reconcilePreview.before.phases,
    });
    await loadPlans();
    setReconcilePreview(null);
    setUpdating(false);
  };

  const handleAddLogEntry = async () => {
    if (!logInput.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const newLog: LogEntry = { date: today, text: logInput.trim().replace(/\n/g, ' ') };
    const updatedLog = [...(plan.log ?? []), newLog];
    setUpdating(true);
    await updatePlan(plan.title, { log: updatedLog });
    await loadPlans();
    setLogInput('');
    setUpdating(false);
  };

  return (
    <div>
      {reconcilePreview && reconcilePreview.planId === plan.id && (
        <ReconcileDiffPanel
          plan={plan}
          before={reconcilePreview.before}
          onApprove={handleApproveReconcile}
          onDiscard={handleDiscardReconcile}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: space[4],
          marginBottom: space[3],
        }}
      >
        <h2
          style={{
            fontFamily: fontFamily.serif,
            fontWeight: 600,
            fontSize: '1.75rem',
            margin: 0,
            lineHeight: lineHeight.tight,
            display: 'flex',
            alignItems: 'center',
            gap: space[3],
          }}
        >
          <PlanIdStamp id={plan.id} />
          {plan.title}
        </h2>
        {!underReview && hasPhases && (
          <Button
            variant="primary"
            size="small"
            className={inProgress ? 'btn-orange' : 'btn-green'}
            onClick={inProgress ? handleStop : handleStart}
            disabled={updating}
          >
            {inProgress ? 'Stop' : 'Start'}
          </Button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[2],
          flexWrap: 'wrap',
          marginBottom: space[4],
        }}
      >
        <Select
          size="small"
          width={140}
          value={plan.status}
          onChange={handleSetStatus}
          disabled={updating}
          options={PLAN_STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] }))}
        />
        <Select
          size="small"
          width={180}
          value={plan.agent ?? ''}
          onChange={handleSetAgent}
          disabled={updating}
          options={[
            { value: '', label: 'Project default agent' },
            ...AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] })),
          ]}
        />
        <span className="text-sm" style={{ opacity: 0.45 }}>
          {plan.updated
            ? `updated ${relativeDate(plan.updated)}`
            : `created ${relativeDate(plan.created)}`}
        </span>
        {plan.tags.map((tag) => (
          <Stamp key={tag} size="small" fillColor="rgba(0,0,0,0.06)">
            {tag}
          </Stamp>
        ))}
        {progress !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flex: '0 0 140px' }}>
            <div style={{ flex: 1 }}>
              <ProgressBar pct={progress.pct} color={STATUS_COLOR[plan.status]} />
            </div>
            <span className="text-sm" style={{ opacity: 0.5, flexShrink: 0 }}>
              {progress.done}/{progress.total}
            </span>
          </div>
        )}
        <ClarifyButton plan={plan} disabled={agentBusy} />
      </div>

      {plan.body && (
        <div style={{ marginBottom: space[4], opacity: 0.85 }}>
          <Markdown>{plan.body}</Markdown>
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
              {(plan.status === 'planned' || plan.status === 'in-progress') &&
                plan.phases.some((p) => !p.done) && (
                  <RunAllPhasesButton plan={plan} disabled={agentBusy} />
                )}
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
                      <Stamp size="small" fillColor="rgba(155, 122, 181, 0.25)" textColor="#7B5E9E">
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
                    <PhaseCopyButton planTitle={plan.title} phaseIndex={index} />
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

      {underReview && (
        <div style={{ display: 'flex', gap: space[3], marginBottom: space[6] }}>
          <Button
            variant="primary"
            size="small"
            className="btn-green"
            onClick={handleApprove}
            disabled={updating}
          >
            Approve &amp; close
          </Button>
          <Button
            variant="primary"
            size="small"
            className="btn-orange"
            onClick={handleNeedsChanges}
            disabled={updating}
          >
            Needs changes
          </Button>
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
            variant="primary"
            size="small"
            className="btn-violet"
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
