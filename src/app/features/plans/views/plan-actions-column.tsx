import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { useActivePlan, useSubjectVocabulary } from '@/app/hooks';
import { verifyDirectCompletion } from '@/app/services/git-api';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { Card, Input, ListItem, Select, Stamp, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { RunAllPhasesButton } from '../actions';
import { CompleteIdeaButton } from '../actions';
import { CreateBranchButton } from '../actions';
import { FixReviewButton } from '../actions';
import { PrReviewButton } from '../actions';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';
import { branchEntityId, canMarkPlanDone, effectiveStatus } from '../helpers';

const NO_SUBJECT = '__no-subject__';

// Matches SidebarSection (Docs/Settings sidebars) — the caps were this column's own.
const sectionLabelClass = 'pc-row-label font-handwritten text-xs font-semibold opacity-[0.45]';

export const PlanActionsColumn = () => {
  const plan = useActivePlan();
  const agentBusy = useAppStore(selectAgentBusy);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
  const { subjects, available: subjectsAvailable } = useSubjectVocabulary();
  const detailView = useAppStore((s) => s.detailView);
  const setDetailView = useAppStore((s) => s.setDetailView);
  const archiveIdeas = useAppStore((s) => s.archiveIdeas);
  const { toast } = useToast();

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
  const onOwnBranch = plan.id !== undefined && branchEntityId(gitBranch) === plan.id;
  const canCreateBranch = (plan.status === 'planned' || inProgress || underReview) && !onOwnBranch;
  const canFixReview = Boolean(
    plan.pr &&
      (plan.pr.state === 'open' || plan.pr.state === 'draft') &&
      plan.pr.unresolvedThreadCount,
  );
  const canReviewPr = plan.pr?.state === 'open' || plan.pr?.state === 'draft';
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

  // Complete Idea verifies a merge and green CI before it promotes; a direct-to-main
  // idea never opens a PR, so this is the equivalent check for that path — a clean
  // tree and a commit naming the idea's id, both confirmed right before the archive
  // write that promotes it to done.
  const handleMarkDone = async () => {
    if (!plan.id) return;
    setArchiving(true);
    try {
      const check = await verifyDirectCompletion(plan.id);
      if (!check.ready) {
        toast({
          title: 'Not ready to complete idea',
          description: `Waiting on ${check.missing.join(', ')}`,
          variant: 'error',
        });
        return;
      }
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
    <div className="flex flex-col">
      <div>
        <div className="flex flex-col">
          <ListItem
            size="small"
            active={detailView === 'details'}
            onClick={() => setDetailView('details')}
            className="pc-row text-xs"
          >
            Details
          </ListItem>
          <ListItem
            size="small"
            active={detailView === 'feedback'}
            onClick={() => setDetailView('feedback')}
            className="pc-row text-xs"
          >
            Feedback
          </ListItem>
        </div>
      </div>

      {/* Read-only: the dropped/reopen override lives in Actions below since
          abandonment leaves no branch or PR to derive status from. */}
      <div className="h-[64px] flex items-center">
        <Stamp
          size="small"
          fillColor={STATUS_STAMP[displayStatus].fill}
          textColor={STATUS_STAMP[displayStatus].text}
        >
          {STATUS_LABEL[displayStatus]}
        </Stamp>
      </div>

      <div>
        <div className={sectionLabelClass}>Subject</div>
        <div className="h-[32px] flex items-center">
          <Select
            className="w-full"
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
      </div>

      {hasRunOrder && (
        <div className="flex items-center justify-between h-[64px]">
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

      <Card size="small">
        <div className="flex flex-col">
          {canCreateBranch && <CreateBranchButton plan={plan} disabled={agentBusy || updating} />}
          {canRunAll && <RunAllPhasesButton plan={plan} disabled={agentBusy || updating} />}
          {canFixReview && <FixReviewButton plan={plan} disabled={agentBusy || updating} />}
          {canReviewPr && <PrReviewButton plan={plan} disabled={agentBusy || updating} />}

          {underReview && plan.pr && (
            <CompleteIdeaButton plan={plan} disabled={agentBusy || updating} />
          )}

          {done && (
            <ListItem
              size="small"
              icon={<span className="text-ink-300">▣</span>}
              onClick={handleArchive}
              disabled={archiving || !plan.id}
              className={`pc-row text-xs ${archiving || !plan.id ? 'opacity-50' : ''}`}
            >
              {archiving ? 'Archiving…' : 'Archive'}
            </ListItem>
          )}

          {canMarkDone && (
            <ListItem
              size="small"
              // Raw glyph: needs an arbitrary green tint paper-ui's CheckIcon can't take.
              icon={<span className="text-watercolor-green-dark">✓</span>}
              onClick={handleMarkDone}
              disabled={archiving || !plan.id}
              className={`pc-row text-xs ${archiving || !plan.id ? 'opacity-50' : ''}`}
            >
              {archiving ? 'Completing…' : 'Complete idea'}
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
              className={`pc-row text-xs ${updating ? 'opacity-50' : ''}`}
            >
              {dropped ? 'Reopen plan' : 'Mark dropped'}
            </ListItem>
          )}
        </div>
      </Card>
    </div>
  );
};
