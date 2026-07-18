import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { useActivePlanTitle } from '@/app/hooks';
import { useProjectSubjects } from '@/app/hooks/use-project-subjects';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { AGENT_IDS, AGENT_LABELS, type AgentId } from '@/types/index';
import { Card, Input, ListItem, Select, Stamp } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { RunAllPhasesButton } from '../actions';
import { FixReviewButton } from '../actions';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';

const NO_SUBJECT = '__no-subject__';

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: fontFamily.handwritten,
  fontSize: fontSize.xs,
  fontWeight: 600,
  lineHeight: 1,
  color: color.textTertiary,
  margin: `0 0 ${space[2]}`,
};

export const PlanActionsColumn = () => {
  const plans = useAppStore((s) => s.plans);
  const activePlanTitle = useActivePlanTitle();
  const agentBusy = useAppStore(selectAgentBusy);
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
  const { subjects } = useProjectSubjects();

  const plan = activePlanTitle ? plans?.entries.find((p) => p.title === activePlanTitle) : null;
  const [orderInput, setOrderInput] = useState('');
  useEffect(() => {
    setOrderInput(plan?.order !== undefined ? String(plan?.order) : '');
  }, [plan?.order]);
  if (!plan) return null;
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

  // Order is an invariant (contiguous 1..N over planned/in-progress/review):
  // the field only shows for those statuses and an empty value reverts.
  const hasRunOrder = inProgress || underReview || plan.status === 'planned';

  const handleOrderBlur = async () => {
    const trimmed = orderInput.trim();
    const nextOrder = Number(trimmed);
    if (trimmed === '' || !Number.isInteger(nextOrder) || nextOrder < 1) {
      setOrderInput(plan.order !== undefined ? String(plan.order) : '');
      return;
    }
    if (nextOrder === plan.order) return;
    await patch({ order: nextOrder });
  };

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
            {/* Read-only: the dropped/reopen override lives in Actions below since
                abandonment leaves no branch or PR to derive status from. */}
            <Stamp
              size="small"
              fillColor={STATUS_STAMP[plan.status].fill}
              textColor={STATUS_STAMP[plan.status].text}
            >
              {STATUS_LABEL[plan.status]}
            </Stamp>
          </div>

          <div>
            <div style={sectionLabelStyle}>Subject</div>
            <Select
              size="small"
              value={plan.subject && subjects.includes(plan.subject) ? plan.subject : NO_SUBJECT}
              onChange={(value) => patch({ subject: value === NO_SUBJECT ? null : value })}
              disabled={updating}
              options={[
                { value: NO_SUBJECT, label: 'No subject' },
                ...subjects.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          {hasRunOrder && (
            <div>
              <div style={sectionLabelStyle}>Order</div>
              <Input
                type="number"
                size="small"
                aria-label="Run order"
                min={1}
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                onBlur={handleOrderBlur}
                disabled={updating}
              />
            </div>
          )}

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

          {plan.tags.length > 0 && (
            <div>
              <div style={sectionLabelStyle}>Tags</div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: space[1], flexWrap: 'wrap' }}
              >
                {plan.tags.map((tag) => (
                  <Stamp key={tag} size="small" fillColor="rgba(0,0,0,0.06)">
                    {tag}
                  </Stamp>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={sectionLabelStyle}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
              {canRunAll && <RunAllPhasesButton plan={plan} disabled={agentBusy || updating} />}
              {canFixReview && <FixReviewButton plan={plan} disabled={agentBusy || updating} />}

              {underReview && (
                // Offline fallback: sticks only once the live PR lookup can't resolve
                // a merge either way (done normally derives from the PR merging).
                <ListItem
                  size="small"
                  // Raw glyph: needs an arbitrary green tint paper-ui's CheckIcon can't take.
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
