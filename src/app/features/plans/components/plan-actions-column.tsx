import { IntentButton } from '@/app/components';
import { updatePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import {
  AGENT_IDS,
  AGENT_LABELS,
  type AgentId,
  PLAN_STATUSES,
  type PlanStatus,
} from '@/types/index';
import { Card, Select } from '@dendelion/paper-ui';
import { useState } from 'react';
import { STATUS_LABEL } from '../constants';
import { RunAllPhasesButton } from './run-all-phases-button';

const sectionLabelStyle: React.CSSProperties = {
  fontSize: fontSize['2xs'],
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: color.textTertiary,
  margin: `0 0 ${space[2]}`,
};

/**
 * The open plan's lifecycle/execution controls, as a paper-texture "Plan" card in
 * the router's sidebar slot for `/` — mirroring the Filters card it replaces while a
 * plan detail is open. Status/agent selects, the Start/Stop (or review) action, and
 * Run all phases live here; the detail view keeps the body, phases table, and log.
 * Reads the active plan from the store so it stays in sync with the detail subtree.
 */
interface PlanActionsColumnProps {
  /** When it's the top card, pull up to line up with the Page; otherwise add a gap above. */
  flush?: boolean;
}

export const PlanActionsColumn = ({ flush = true }: PlanActionsColumnProps) => {
  const plans = useAppStore((s) => s.plans);
  const activePlanTitle = useAppStore((s) => s.activePlanTitle);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const [updating, setUpdating] = useState(false);

  const plan = activePlanTitle ? plans?.entries.find((p) => p.title === activePlanTitle) : null;
  if (!plan) return null;

  const agentBusy =
    agentStatus !== null && agentStatus.status !== 'done' && agentStatus.status !== 'error';
  const hasPhases = plan.phases.length > 0;
  const inProgress = plan.status === 'in-progress';
  const underReview = plan.status === 'review';
  const hasUnchecked = plan.phases.some((p) => !p.done);
  const canRunAll = (plan.status === 'planned' || inProgress) && hasUnchecked;

  const patch = async (updates: Parameters<typeof updatePlan>[1]) => {
    setUpdating(true);
    await updatePlan(plan.title, updates);
    await loadPlans();
    setUpdating(false);
  };

  return (
    // Flush (top card): pull up by the SidebarShell's top padding to line up with the
    // Page. Otherwise (below the review queue): a normal gap above.
    <div style={{ marginTop: flush ? `calc(-1 * ${space[5]})` : space[5] }}>
      <Card surface="paper" texture="speckle" size="small">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
          <h2
            style={{
              margin: 0,
              fontFamily: fontFamily.serif,
              fontSize: fontSize.base,
              color: color.textPrimary,
            }}
          >
            Plan
          </h2>

          <div>
            <div style={sectionLabelStyle}>Status</div>
            <Select
              size="small"
              value={plan.status}
              onChange={(value) => patch({ status: value as PlanStatus })}
              disabled={updating}
              options={PLAN_STATUSES.map((status) => ({
                value: status,
                label: STATUS_LABEL[status],
              }))}
            />
          </div>

          <div>
            <div style={sectionLabelStyle}>Agent</div>
            <Select
              size="small"
              value={plan.agent ?? ''}
              onChange={(value) => patch({ agent: value ? (value as AgentId) : null })}
              disabled={updating}
              options={[
                { value: '', label: 'Project default agent' },
                ...AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] })),
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
            {!underReview && hasPhases && (
              <IntentButton
                intent={inProgress ? 'stop' : 'go'}
                size="small"
                fullWidth
                onClick={() => patch({ status: inProgress ? 'planned' : 'in-progress' })}
                disabled={updating}
              >
                {inProgress ? 'Stop' : 'Start'}
              </IntentButton>
            )}

            {canRunAll && <RunAllPhasesButton plan={plan} disabled={agentBusy} />}

            {underReview && (
              <>
                <IntentButton
                  intent="go"
                  size="small"
                  fullWidth
                  onClick={() => patch({ status: 'done' })}
                  disabled={updating}
                >
                  Approve &amp; close
                </IntentButton>
                <IntentButton
                  intent="stop"
                  size="small"
                  fullWidth
                  onClick={() => patch({ status: 'in-progress' })}
                  disabled={updating}
                >
                  Needs changes
                </IntentButton>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
