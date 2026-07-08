import { IntentButton } from '@/app/components';
import { Markdown } from '@/app/components/markdown';
import { createPlanBranch } from '@/app/services/git-api';
import { updatePlan } from '@/app/services/plans-api';
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
import { STATUS_COLOR } from '../constants';
import { phaseProgress, relativeDate } from '../helpers';
import { AddReviewPhasesButton } from './add-review-phases-button';
import { AgentStartButton } from './agent-start-button';
import { AuditPhasesButton } from './audit-phases-button';
import { ClarifyButton } from './clarify-button';
import { DraftPlanButton } from './draft-plan-button';
import { ExtendIdeaButton } from './extend-idea-button';
import { PhaseCopyButton } from './phase-copy-button';
import { PlanIdStamp } from './plan-id-stamp';
import { PrBadge } from './pr-badge';
import { ProgressBar } from './progress-bar';
import { ReconcileButton } from './reconcile-button';

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
  const loadPlans = useAppStore((s) => s.loadPlans);
  const allPlans = useAppStore((s) => s.plans);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const { toast } = useToast();
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
  const [updating, setUpdating] = useState(false);
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
    setUpdating(true);
    const allChecked = nextPhases.every((p) => p.done);
    try {
      // Auto-set to review when last phase is checked
      if (allChecked && plan.status === 'in-progress') {
        await updatePlan(plan.title, { phases: nextPhases, status: 'review' });
      } else {
        await updatePlan(plan.title, { phases: nextPhases });
      }
      await loadPlans();
    } catch (err) {
      toast({ title: 'Update failed', description: (err as Error).message, variant: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const handleAddReviewPhases = async (newPhases: PhaseItem[]) => {
    setUpdating(true);
    try {
      await updatePlan(plan.title, { phases: [...plan.phases, ...newPhases] });
      await loadPlans();
    } catch (err) {
      toast({ title: 'Update failed', description: (err as Error).message, variant: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const handleAddLogEntry = async () => {
    if (!logInput.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const newLog: LogEntry = { date: today, text: logInput.trim().replace(/\n/g, ' ') };
    const updatedLog = [...(plan.log ?? []), newLog];
    setUpdating(true);
    try {
      await updatePlan(plan.title, { log: updatedLog });
      await loadPlans();
      setLogInput('');
    } catch (err) {
      toast({ title: 'Update failed', description: (err as Error).message, variant: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      <h2
        style={{
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          fontSize: '1.75rem',
          margin: `0 0 ${space[3]}`,
          lineHeight: lineHeight.tight,
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
        }}
      >
        <PlanIdStamp id={plan.id} />
        {plan.title}
      </h2>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[2],
          flexWrap: 'wrap',
          marginBottom: space[4],
        }}
      >
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
        {plan.pr && <PrBadge pr={plan.pr} />}
        <ClarifyButton plan={plan} disabled={agentBusy} />
      </div>

      {showBranchRow && !onOwnBranch && (
        <Card size="small" accent accentColor="amber" className="mb-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
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
        <p className="text-sm" style={{ margin: `0 0 ${space[4]}`, opacity: 0.45 }}>
          Working branch: <code>{gitBranch}</code>
        </p>
      )}

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
          <IntentButton
            intent="log"
            size="small"
            onClick={handleAddLogEntry}
            disabled={updating || !logInput.trim()}
          >
            Add entry
          </IntentButton>
        </div>
      </div>
    </div>
  );
};
