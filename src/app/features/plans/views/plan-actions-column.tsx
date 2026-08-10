import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { useActivePlanTitle, useSubjectVocabulary } from '@/app/hooks';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { Breadcrumb, Input, ListItem, Select, Stamp, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { RunAllPhasesButton } from '../actions';
import { FixReviewButton } from '../actions';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';
import { canMarkPlanDone, effectiveStatus } from '../helpers';

const NO_SUBJECT = '__no-subject__';

const sectionLabelClass = 'text-2xs font-semibold tracking-[0.08em] uppercase text-ink-300';

export const PlanActionsColumn = () => {
  const plans = useAppStore((s) => s.plans);
  const activePlanTitle = useActivePlanTitle();
  const agentBusy = useAppStore(selectAgentBusy);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
  const { subjects, available: subjectsAvailable } = useSubjectVocabulary();
  const detailView = useAppStore((s) => s.detailView);
  const setDetailView = useAppStore((s) => s.setDetailView);
  const archiveIdeas = useAppStore((s) => s.archiveIdeas);
  const { toast } = useToast();
  const navigate = useNavigate();

  const plan = activePlanTitle ? plans?.entries.find((p) => p.title === activePlanTitle) : null;
  const [orderInput, setOrderInput] = useState('');
  const [archiving, setArchiving] = useState(false);
  useEffect(() => {
    setOrderInput(plan?.order !== undefined ? String(plan?.order) : '');
  }, [plan?.order]);
  if (!plan) return null;
  const displayStatus = effectiveStatus(plan, agentStatus);
  const inProgress = plan.status === 'in-progress';
  const underReview = plan.status === 'review';
  const dropped = plan.status === 'dropped';
  const done = plan.status === 'done';
  const hasUnchecked = plan.phases.some((p) => !p.done);
  const canRunAll = (plan.status === 'planned' || inProgress) && hasUnchecked;
  const canMarkDone = canMarkPlanDone(plan);
  const canFixReview = Boolean(
    plan.pr &&
      (plan.pr.state === 'open' || plan.pr.state === 'draft') &&
      plan.pr.unresolvedThreadCount,
  );
  const orphanSubject =
    subjectsAvailable && plan.subject && !subjects.includes(plan.subject)
      ? plan.subject
      : undefined;

  const patch = (updates: Parameters<typeof patchByTitle>[1]) => patchByTitle(plan.title, updates);

  const handleArchive = async () => {
    if (!plan.id) return;
    setArchiving(true);
    try {
      await archiveIdeas([plan.id]);
    } catch (err) {
      toast({ title: 'Archive failed', description: (err as Error).message, variant: 'error' });
    } finally {
      setArchiving(false);
    }
  };

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
    <div className="flex flex-col gap-4 -mt-5">
      <Breadcrumb
        items={[
          { id: 'plans', label: 'Plans', onClick: () => navigate({ to: '/' }) },
          { id: 'plan', label: plan.title },
        ]}
      />
      <div>
        <div className={`${sectionLabelClass} mb-1.5`}>Show</div>
        <div className="flex flex-col gap-1">
          <ListItem
            size="small"
            active={detailView === 'details'}
            onClick={() => setDetailView('details')}
            className="text-xs leading-4 py-2"
          >
            Details
          </ListItem>
          <ListItem
            size="small"
            active={detailView === 'feedback'}
            onClick={() => setDetailView('feedback')}
            className="text-xs leading-4 py-2"
          >
            Feedback
          </ListItem>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className={sectionLabelClass}>Status</div>
        {/* Read-only: the dropped/reopen override lives in Actions below since
            abandonment leaves no branch or PR to derive status from. */}
        <Stamp
          size="small"
          fillColor={STATUS_STAMP[displayStatus].fill}
          textColor={STATUS_STAMP[displayStatus].text}
        >
          {STATUS_LABEL[displayStatus]}
        </Stamp>
      </div>

      <div>
        <div className={`${sectionLabelClass} mb-1.5`}>Subject</div>
        <Select
          size="small"
          value={plan.subject ?? NO_SUBJECT}
          onChange={(value) => patch({ subject: value === NO_SUBJECT ? null : value })}
          disabled={updating || !subjectsAvailable}
          options={[
            { value: NO_SUBJECT, label: 'No subject' },
            ...(orphanSubject
              ? [{ value: orphanSubject, label: `${orphanSubject} (orphan)` }]
              : []),
            ...(!subjectsAvailable && plan.subject && !orphanSubject
              ? [{ value: plan.subject, label: plan.subject }]
              : []),
            ...subjects.map((s) => ({ value: s, label: s })),
          ]}
        />
      </div>

      {hasRunOrder && (
        <div className="flex items-center justify-between">
          <div className={sectionLabelClass}>Order</div>
          <Input
            type="number"
            size="small"
            aria-label="Run order"
            min={1}
            value={orderInput}
            onChange={(e) => setOrderInput(e.target.value)}
            onBlur={handleOrderBlur}
            disabled={updating}
            className="w-20"
          />
        </div>
      )}

      <div>
        <div className={`${sectionLabelClass} mb-1.5`}>Actions</div>
        <div className="flex flex-col gap-1">
          {canRunAll && <RunAllPhasesButton plan={plan} disabled={agentBusy || updating} />}
          {canFixReview && <FixReviewButton plan={plan} disabled={agentBusy || updating} />}

          {underReview && (
            // Offline fallback: sticks only once the live PR lookup can't resolve
            // a merge either way (done normally derives from the PR merging).
            <ListItem
              size="small"
              // Raw glyph: needs an arbitrary green tint paper-ui's CheckIcon can't take.
              icon={<span className="text-watercolor-green-dark">✓</span>}
              onClick={() => patch({ status: 'done' })}
              disabled={updating}
              className={`text-xs leading-4 py-2 ${updating ? 'opacity-50' : ''}`}
            >
              Approve &amp; close
            </ListItem>
          )}

          {done && (
            <ListItem
              size="small"
              icon={<span className="text-ink-300">▣</span>}
              onClick={handleArchive}
              disabled={archiving || !plan.id}
              className={`text-xs leading-4 py-2 ${archiving || !plan.id ? 'opacity-50' : ''}`}
            >
              {archiving ? 'Archiving…' : 'Archive'}
            </ListItem>
          )}

          {canMarkDone && (
            <ListItem
              size="small"
              // Raw glyph: needs an arbitrary green tint paper-ui's CheckIcon can't take.
              icon={<span className="text-watercolor-green-dark">✓</span>}
              onClick={handleArchive}
              disabled={archiving || !plan.id}
              className={`text-xs leading-4 py-2 ${archiving || !plan.id ? 'opacity-50' : ''}`}
            >
              {archiving ? 'Marking done…' : 'Mark done'}
            </ListItem>
          )}

          {!done && (
            <ListItem
              size="small"
              icon={
                <span
                  className={dropped ? 'text-watercolor-green-dark' : 'text-watercolor-rose-dark'}
                >
                  {dropped ? '↺' : '⊘'}
                </span>
              }
              onClick={() => patch({ status: dropped ? null : 'dropped' })}
              disabled={updating}
              className={`text-xs leading-4 py-2 ${updating ? 'opacity-50' : ''}`}
            >
              {dropped ? 'Reopen plan' : 'Mark dropped'}
            </ListItem>
          )}
        </div>
      </div>
    </div>
  );
};
