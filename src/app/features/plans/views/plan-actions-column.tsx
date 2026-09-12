import { RefreshIcon } from '@/app/components/icons';
import { SidebarCard } from '@/app/components/sidebar';
import { SidebarCommand, SidebarField } from '@/app/components/sidebar';
import { usePlanActionsColumn } from '@/app/features/plans/hooks';
import {
  CheckIcon,
  CloseIcon,
  FolderIcon,
  Input,
  ListItem,
  Select,
  Stamp,
} from '@dendelion/paper-ui';
import {
  CompleteIdeaButton,
  CreateBranchButton,
  DraftPlanButton,
  FixReviewButton,
  PrReviewButton,
  RunAllPhasesButton,
} from '../actions';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';

export const PlanActionsColumn = () => {
  const data = usePlanActionsColumn();
  if (!data) return null;
  const {
    plan,
    updating,
    subjectsAvailable,
    subjects,
    detailView,
    setDetailView,
    orderInput,
    setOrderInput,
    displayStatus,
    hasRunOrder,
    orphanSubject,
    patch,
    handleOrderBlur,
    NO_SUBJECT,
  } = data;

  return (
    <SidebarCard>
      <div className="flex flex-col">
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
      </div>
    </SidebarCard>
  );
};

export const PlanActionsCommandsColumn = () => {
  const data = usePlanActionsColumn();
  if (!data) return null;
  const {
    plan,
    agentBusy,
    updating,
    archiving,
    dropped,
    done,
    canCreateBranch,
    canRunAll,
    canRedraft,
    canFixReview,
    canReviewPr,
    underReview,
    canMarkDone,
    ideaView,
    otherPlans,
    patch,
    handleArchive,
    handleMarkDone,
  } = data;

  return (
    <SidebarCard>
      <div className="flex flex-col">
        {canCreateBranch && <CreateBranchButton plan={plan} disabled={agentBusy || updating} />}
        {canRunAll && <RunAllPhasesButton plan={plan} disabled={agentBusy || updating} />}
        {canRedraft && <DraftPlanButton idea={ideaView} otherPlans={otherPlans} redraft sidebar />}
        {canFixReview && <FixReviewButton plan={plan} disabled={agentBusy || updating} />}
        {canReviewPr && <PrReviewButton plan={plan} disabled={agentBusy || updating} />}

        {underReview && plan.pr && (
          <CompleteIdeaButton plan={plan} disabled={agentBusy || updating} />
        )}

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
    </SidebarCard>
  );
};
