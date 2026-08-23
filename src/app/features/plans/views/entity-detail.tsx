import { detailHeadingClassName } from '@/app/components/detail-heading-style';
import {
  usePlanStatusPatch,
  useRunningPhaseFill,
  useSendFeedbackMessage,
} from '@/app/features/plans/hooks';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { rollupUsage } from '@/core/phase-run';
import type { IdeaEntry, PhaseItem, PlanEntry } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useEffect, useMemo } from 'react';
import { RefreshButton } from '../actions';
import { PlanIdStamp } from '../components';
import { STATUS_COLOR } from '../constants';
import {
  effectiveStatus,
  latestReviewNote,
  relativeDate,
  rollupProgress,
  runningPrReviewForPlan,
  runningTaskForPlan,
} from '../helpers';
import { ClarificationsSection } from './clarifications-section';
import { DeliverSection } from './deliver-section';
import { FeedbackSection } from './feedback-section';
import { FixesSection } from './fixes-section';
import { ParentLinkRow } from './parent-link-row';
import { PhasesSection } from './phases-section';
import { PlanBodySection } from './plan-body-section';
import { PlanProgressRow } from './plan-progress-row';
import { TicketsSection } from './tickets-section';
import { TrailSection } from './trail-section';

interface EntityDetailProps {
  plan: PlanEntry;
}

export const EntityDetail = ({ plan }: EntityDetailProps) => {
  const allPlans = useAppStore((s) => s.plans);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const { toast } = useToast();
  const { patch: patchByTitle, updating } = usePlanStatusPatch();
  const agentStatus = useAppStore((s) => s.agentStatus);
  const agentBusy = useAppStore(selectAgentBusy);
  const detailView = useAppStore((s) => s.detailView);
  const taskLog = useAppStore((s) => s.taskLog);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);
  const planTask = runningTaskForPlan(plan.id, agentStatus);
  const reviewing = Boolean(runningPrReviewForPlan(plan.id, agentStatus));
  const reviewNote = latestReviewNote(plan.thread);
  const runningFill = useRunningPhaseFill(planTask, taskLog);
  const usageRollup = useMemo(() => rollupUsage(taskLog, plan.id), [taskLog, plan.id]);
  const auditRunning = planTask?.taskKind === 'audit';
  const progress = rollupProgress(plan, runningFill?.fraction ?? 0);
  const hasPhases = plan.phases.length > 0;
  const showFeedback = detailView === 'feedback';
  const ideaView: IdeaEntry = {
    id: plan.id ?? null,
    title: plan.title,
    body: plan.body,
    log: plan.log,
  };
  const otherPlans = (allPlans?.entries ?? []).filter((p) => p.id !== plan.id);

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const handleTogglePhase = async (index: number) => {
    const nextPhases: PhaseItem[] = plan.phases.map((phase, i) =>
      i === index ? { ...phase, done: !phase.done } : phase,
    );
    const allChecked = nextPhases.every((p) => p.done);
    if (allChecked && plan.status === 'in-progress') {
      await patchByTitle(plan.title, { phases: nextPhases, status: 'review' });
    } else {
      await patchByTitle(plan.title, { phases: nextPhases });
    }
  };

  const handleAddPhases = async (newPhases: PhaseItem[]) => {
    await patchByTitle(plan.title, { phases: [...plan.phases, ...newPhases] });
  };

  const handleToggleFix = async (index: number) => {
    const nextFixes: PhaseItem[] = (plan.fixes ?? []).map((fix, i) =>
      i === index ? { ...fix, done: !fix.done } : fix,
    );
    const allChecked = nextFixes.every((f) => f.done);
    if (allChecked && plan.status === 'in-progress') {
      await patchByTitle(plan.title, { fixes: nextFixes, status: 'review' });
    } else {
      await patchByTitle(plan.title, { fixes: nextFixes });
    }
  };

  const {
    sending,
    send: sendFeedbackMessage,
    undo: feedbackUndo,
    undoing: undoingFeedback,
    undoEdit,
  } = useSendFeedbackMessage(plan, { reload: loadPlans, notify: toast });

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className={`${detailHeadingClassName} m-0 flex items-center gap-3 min-w-0 flex-wrap`}>
          <PlanIdStamp id={plan.id} />
          {plan.title}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0 font-handwritten">
          <span className="text-sm opacity-[0.45] whitespace-nowrap">
            <span className="max-[480px]:hidden">{plan.updated ? 'updated ' : 'created '}</span>
            {relativeDate(plan.updated ?? plan.created)}
          </span>
          <RefreshButton />
        </div>
      </div>

      <ParentLinkRow plan={plan} otherPlans={otherPlans} />

      {/* One strip, not three full-width bands — they all answer "where is this and
          what has it cost". Wraps to stacked rows when the column is too narrow. */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mb-3">
        <TrailSection
          planId={plan.id}
          released={plan.released}
          reviewing={reviewing}
          reviewNote={reviewNote}
        />
        {!showFeedback && (
          <PlanProgressRow
            progress={progress}
            color={STATUS_COLOR[effectiveStatus(plan, agentStatus)]}
            rollup={usageRollup}
          />
        )}
      </div>

      {showFeedback ? (
        <FeedbackSection
          plan={plan}
          updating={sending}
          onSend={sendFeedbackMessage}
          undo={feedbackUndo}
          undoing={undoingFeedback}
          onUndo={undoEdit}
        />
      ) : (
        <>
          {plan.entityKind === 'board' ? (
            <TicketsSection plan={plan} otherPlans={otherPlans} />
          ) : (
            <PhasesSection
              plan={plan}
              auditRunning={auditRunning}
              agentBusy={agentBusy}
              runningFill={runningFill}
              updating={updating}
              onTogglePhase={handleTogglePhase}
              onToggleFix={handleToggleFix}
              onAddPhases={handleAddPhases}
              ideaView={ideaView}
              otherPlans={otherPlans}
              deliverPanel={<DeliverSection plan={plan} />}
            />
          )}

          <FixesSection plan={plan} otherPlans={otherPlans} />

          <ClarificationsSection clarifications={plan.clarifications ?? []} />

          <PlanBodySection plan={plan} />
        </>
      )}
    </div>
  );
};
