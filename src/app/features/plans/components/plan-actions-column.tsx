import { useActivePlanTitle } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { AGENT_IDS, AGENT_LABELS, type AgentId } from '@/types/index';
import { Card, ListItem, Select, Stamp } from '@dendelion/paper-ui';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';
import { usePlanStatusPatch } from '../use-plan-status-patch';
import { FixReviewButton } from './fix-review-button';
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
 * plan detail is open. Status is read-only here (derived from phases/branch/PR,
 * IDEA-56) alongside the dropped/reopen override, the agent select, run-all-phases,
 * and the review-close action; the detail view keeps the body, phases table, and log.
 * Reads the active plan from the store so it stays in sync with the detail subtree.
 */
export const PlanActionsColumn = () => {
  const plans = useAppStore((s) => s.plans);
  const activePlanTitle = useActivePlanTitle();
  const agentStatus = useAppStore((s) => s.agentStatus);
  const { patch: patchByTitle, updating } = usePlanStatusPatch();

  const plan = activePlanTitle ? plans?.entries.find((p) => p.title === activePlanTitle) : null;
  if (!plan) return null;

  const agentBusy =
    agentStatus !== null && agentStatus.status !== 'done' && agentStatus.status !== 'error';
  const inProgress = plan.status === 'in-progress';
  const underReview = plan.status === 'review';
  const dropped = plan.status === 'dropped';
  const hasUnchecked = plan.phases.some((p) => !p.done);
  const canRunAll = (plan.status === 'planned' || inProgress) && hasUnchecked;
  const canFixReview = Boolean(
    plan.pr &&
      (plan.pr.state === 'open' || plan.pr.state === 'draft') &&
      plan.pr.unresolvedThreadCount,
  );

  const patch = (updates: Parameters<typeof patchByTitle>[1]) => patchByTitle(plan.title, updates);

  return (
    // Pull up by the SidebarShell's top padding to line up with the Page.
    <div style={{ marginTop: `calc(-1 * ${space[5]})` }}>
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
            {/* Status derives from phases/branch/PR (IDEA-56) and is read-only
                here; the dropped/reopen override lives in Actions below since
                abandonment leaves no branch or PR to derive it from. */}
            <Stamp
              size="small"
              fillColor={STATUS_STAMP[plan.status].fill}
              textColor={STATUS_STAMP[plan.status].text}
            >
              {STATUS_LABEL[plan.status]}
            </Stamp>
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

          {/* One consistent action list instead of scattered filled buttons —
              each row is a quiet paper ListItem with a meaning-colored glyph. */}
          <div>
            <div style={sectionLabelStyle}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
              {canRunAll && <RunAllPhasesButton plan={plan} disabled={agentBusy || updating} />}
              {canFixReview && <FixReviewButton plan={plan} disabled={agentBusy || updating} />}

              {underReview && (
                // Done normally derives from the PR merging (IDEA-56); this is the
                // offline/no-GitHub fallback the idea calls out — it only sticks
                // once the live PR lookup can't resolve a merge either way.
                <ListItem
                  size="small"
                  icon={<span style={{ color: color.accentGreenDark }}>✓</span>}
                  onClick={() => patch({ status: 'done' })}
                  disabled={updating}
                  style={updating ? { opacity: 0.5 } : undefined}
                >
                  Approve &amp; close
                </ListItem>
              )}

              <ListItem
                size="small"
                icon={
                  <span style={{ color: dropped ? color.accentGreenDark : color.accentRoseDark }}>
                    {dropped ? '↺' : '⊘'}
                  </span>
                }
                onClick={() => patch({ status: dropped ? null : 'dropped' })}
                disabled={updating}
                style={updating ? { opacity: 0.5 } : undefined}
              >
                {dropped ? 'Reopen plan' : 'Mark dropped'}
              </ListItem>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
