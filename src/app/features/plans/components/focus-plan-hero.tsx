import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, space } from '@/app/styles/tokens';
import type { PhaseItem, PlanEntry } from '@/types/index';
import { Card, Checkbox, Spinner, Stamp } from '@dendelion/paper-ui';
import { STATUS_ACCENT, STATUS_COLOR, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { phaseProgress } from '../helpers';
import { AgentStartButton } from './agent-start-button';
import { AuditPhasesButton } from './audit-phases-button';
import { PlanIdStamp } from './plan-id-stamp';
import { ProgressBar } from './progress-bar';
import { ReconcileButton } from './reconcile-button';

interface FocusPlanHeroProps {
  plan: PlanEntry | undefined;
  onOpenPlan: (title: string) => void;
}

/**
 * Leads the Plans landing with the single plan a work session is actually
 * about — findFocusPlan's pick — so it isn't buried at the same weight as
 * 40+ closed plans in the list below (per IDEA-39).
 */
export const FocusPlanHero = ({ plan, onOpenPlan }: FocusPlanHeroProps) => {
  const agentStatus = useAppStore((s) => s.agentStatus);

  if (!plan) {
    return (
      <div style={{ marginBottom: space[4] }}>
        <Card size="small" texture="canvas" className="plan-row-card">
          <span className="text-sm" style={{ opacity: 0.5 }}>
            No active plan — pick one below to focus on.
          </span>
        </Card>
      </div>
    );
  }

  const progress = phaseProgress(plan);
  const nextPhaseIndex = plan.phases.findIndex((p: PhaseItem) => !p.done);
  const agentBusy =
    agentStatus !== null && agentStatus.status !== 'done' && agentStatus.status !== 'error';
  const isFocusPlanAgent = agentBusy && agentStatus !== null && agentStatus.planId === plan.id;
  const agentPhaseIndex = isFocusPlanAgent ? agentStatus.phaseIndex : null;
  const auditRunning = isFocusPlanAgent && agentStatus.phaseIndex === undefined;

  return (
    <div style={{ marginBottom: space[5] }}>
      <Card size="medium" accent accentColor={STATUS_ACCENT[plan.status]}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: space[3],
            marginBottom: space[3],
          }}
        >
          <button
            type="button"
            onClick={() => onOpenPlan(plan.title)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              font: 'inherit',
              color: 'inherit',
              minWidth: 0,
            }}
          >
            <PlanIdStamp id={plan.id} />
            <span
              style={{
                fontFamily: fontFamily.serif,
                fontWeight: 600,
                fontSize: '1.4rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {plan.title}
            </span>
          </button>
          <Stamp
            size="small"
            fillColor={STATUS_STAMP[plan.status].fill}
            textColor={STATUS_STAMP[plan.status].text}
          >
            {STATUS_LABEL[plan.status]}
          </Stamp>
        </div>

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

        {plan.phases.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: space[1],
              marginBottom: space[4],
            }}
          >
            {plan.phases.map((phase, index) => (
              <div
                key={`${plan.title}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[2],
                  padding: `${space[1]} ${space[2]}`,
                  borderRadius: 6,
                  background: index === nextPhaseIndex ? 'rgba(212, 163, 115, 0.15)' : undefined,
                }}
              >
                <Checkbox checked={phase.done} disabled readOnly />
                <span
                  className="text-sm"
                  style={{
                    textDecoration: phase.done ? 'line-through' : 'none',
                    opacity: phase.done ? 0.45 : 1,
                    fontWeight: index === nextPhaseIndex ? 600 : 400,
                  }}
                >
                  {phase.text}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
          {auditRunning && <Spinner size="small" label="Audit running…" />}
          {!auditRunning &&
            nextPhaseIndex !== -1 &&
            (agentPhaseIndex === nextPhaseIndex ? (
              <Spinner size="small" label={`Agent ${agentStatus?.status}…`} />
            ) : (
              <AgentStartButton planId={plan.id} phaseIndex={nextPhaseIndex} disabled={agentBusy} />
            ))}
          {(plan.status === 'review' || plan.status === 'done') && (
            <AuditPhasesButton plan={plan} disabled={agentBusy} />
          )}
          {plan.status !== 'done' && <ReconcileButton plan={plan} disabled={agentBusy} />}
        </div>
      </Card>
    </div>
  );
};
