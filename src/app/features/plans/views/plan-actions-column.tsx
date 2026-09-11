import { RefreshIcon } from '@/app/components/icons';
import { SidebarCommand, SidebarDivider, SidebarField } from '@/app/components/sidebar';
import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { useActivePlan, useSubjectVocabulary } from '@/app/hooks';
import { verifyDirectCompletion } from '@/app/services/git-api';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { branchEntityId } from '@/app/utils/branch-entity-id';
import type { IdeaEntry } from '@/types/index';
import {
  CheckIcon,
  CloseIcon,
  FolderIcon,
  Input,
  ListItem,
  Select,
  Stamp,
  useToast,
} from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import {
  CompleteIdeaButton,
  CreateBranchButton,
  DraftPlanButton,
  FixReviewButton,
  PrReviewButton,
  RunAllPhasesButton,
} from '../actions';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';
import { canMarkPlanDone, effectiveStatus, isUntouchedPlan } from '../helpers';

const NO_SUBJECT = '__no-subject__';

export const PlanActionsColumn = () => {
  const plan = useActivePlan();
  const agentBusy = useAppStore(selectAgentBusy);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const allPlans = useAppStore((s) => s.plans);
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
  const hasUnchecked =
    plan.phases.some((p) => !p.done) || (plan.fixes ?? []).some((fix) => !fix.done);
  const canRunAll = (plan.status === 'planned' || inProgress || underReview) && hasUnchecked;
  const canRedraft = isUntouchedPlan(plan);
  const canMarkDone = canMarkPlanDone(plan);
  const onOwnBranch = plan.id !== undefined && branchEntityId(gitBranch) === plan.id;
  // A board holds no code of its own — its tickets carry the work, and each branches
  // for itself — so it never offers a branch.
  const canCreateBranch =
    plan.entityKind !== 'board' &&
    (plan.status === 'planned' || inProgress || underReview) &&
    !onOwnBranch;
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

  const ideaView: IdeaEntry = {
    id: plan.id ?? null,
    title: plan.title,
    body: plan.body,
    log: plan.log,
  };
  const otherPlans = (allPlans?.entries ?? []).filter((p) => p.id !== plan.id);

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

  // Equivalent of Complete Idea's merge+CI check for a direct-to-main idea, which
  // never opens a PR: a clean tree and a commit naming the idea's id, instead.
  const handleMarkDone = async () => {
    if (!plan.id) return;
    setArchiving(true);
    try {
      if (plan.entityKind !== 'board') {
        const check = await verifyDirectCompletion(plan.id);
        if (!check.ready) {
          toast({
            title: 'Not ready to complete idea',
            description: `Waiting on ${check.missing.join(', ')}`,
            variant: 'error',
          });
          return;
        }
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
      <div className="h-[32px] flex items-center">
        <Stamp
          size="small"
          fillColor={STATUS_STAMP[displayStatus].fill}
          textColor={STATUS_STAMP[displayStatus].text}
        >
          {STATUS_LABEL[displayStatus]}
        </Stamp>
      </div>

      <SidebarField label="Subject">
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
      </SidebarField>

      {hasRunOrder && (
        <SidebarField label="Order">
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
        </SidebarField>
      )}

      <SidebarDivider />

      <div className="flex flex-col">
        {canCreateBranch && <CreateBranchButton plan={plan} disabled={agentBusy || updating} />}
        {canRunAll && <RunAllPhasesButton plan={plan} disabled={agentBusy || updating} />}
        {canRedraft && <DraftPlanButton idea={ideaView} otherPlans={otherPlans} redraft sidebar />}
        {canFixReview && <FixReviewButton plan={plan} disabled={agentBusy || updating} />}
        {canReviewPr && <PrReviewButton plan={plan} disabled={agentBusy || updating} />}

        {underReview && plan.pr && (
          <CompleteIdeaButton plan={plan} disabled={agentBusy || updating} />
        )}
      </div>

      <SidebarDivider />

      <div className="flex flex-col">
        {done && (
          <SidebarCommand
            icon={<FolderIcon size={16} />}
            onClick={handleArchive}
            disabled={!plan.id}
            busy={archiving ? 'Archiving…' : undefined}
          >
            Archive
          </SidebarCommand>
        )}

        {canMarkDone && (
          <SidebarCommand
            icon={<CheckIcon size={16} />}
            onClick={handleMarkDone}
            disabled={!plan.id}
            busy={archiving ? 'Completing…' : undefined}
          >
            Complete idea
          </SidebarCommand>
        )}

        {!done && (
          <SidebarCommand
            icon={dropped ? <RefreshIcon size={16} /> : <CloseIcon size={16} />}
            tone={dropped ? undefined : 'danger'}
            onClick={() => patch({ status: dropped ? null : 'dropped' })}
            disabled={updating}
          >
            {dropped ? 'Reopen plan' : 'Mark dropped'}
          </SidebarCommand>
        )}
      </div>
    </div>
  );
};
