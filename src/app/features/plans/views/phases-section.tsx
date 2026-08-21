import {
  PhaseActionsCell,
  PhaseCheckboxCell,
  PhaseTitleCell,
} from '@/app/features/plans/components';
import type { RunningPhaseFill } from '@/app/features/plans/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { formatRunSummary } from '@/core/phase-run';
import type { IdeaEntry, PhaseItem, PlanEntry } from '@/types/index';
import { Button, Spinner, Table, Tooltip } from '@dendelion/paper-ui';
import type { CSSProperties, ReactNode } from 'react';
import {
  AddReviewPhasesButton,
  AuditPhasesButton,
  DraftPlanButton,
  ExtendIdeaButton,
  ReconcileButton,
} from '../actions';
import { type WorkRow, isRunningRow } from '../helpers';

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

export const PhasesSection = ({
  plan,
  auditRunning,
  agentBusy,
  runningFill,
  updating,
  onTogglePhase,
  onToggleFix,
  onAddReviewPhases,
  ideaView,
  otherPlans,
  deliverPanel,
}: {
  plan: PlanEntry;
  auditRunning: boolean;
  agentBusy: boolean;
  runningFill: RunningPhaseFill | null;
  updating: boolean;
  onTogglePhase: (index: number) => void;
  onToggleFix: (index: number) => void;
  onAddReviewPhases: (newPhases: PhaseItem[]) => Promise<void>;
  ideaView: IdeaEntry;
  otherPlans: PlanEntry[];
  deliverPanel: ReactNode;
}) => {
  const launchRunAll = useAppStore((s) => s.launchRunAll);
  const fixes = plan.fixes ?? [];
  const hasOpenFix = fixes.some((fix) => !fix.done);
  const rows: WorkRow[] = [
    ...plan.phases.map((item, index) => ({ kind: 'phase' as const, item, index })),
    ...fixes.map((item, index) => ({ kind: 'fix' as const, item, index })),
  ];
  return (
    <div
      className="mb-8"
      style={
        runningFill
          ? ({ '--phase-fill': `${runningFill.fraction * 100}%` } as CSSProperties)
          : undefined
      }
    >
      <Table
        data={rows}
        toolbar={{
          title: <h3 className={`${sectionHeadingClass} m-0`}>Phases</h3>,
          actions: (
            <>
              {auditRunning && <Spinner size="small" label="Audit running…" />}
              {/* Undrafted: the only sensible action is extending the idea. Auditing,
                  reconciling and adding review phases all presuppose phases to act on. */}
              {rows.length === 0 && <ExtendIdeaButton idea={ideaView} />}
              {rows.length > 0 && (plan.status === 'review' || plan.status === 'done') && (
                <AuditPhasesButton plan={plan} />
              )}
              {rows.length > 0 && plan.status !== 'done' && <ReconcileButton plan={plan} />}
              {rows.length > 0 && (
                <AddReviewPhasesButton
                  onAdd={onAddReviewPhases}
                  disabled={updating}
                  entityId={plan.id ?? plan.title}
                />
              )}
              {plan.id && hasOpenFix && (
                <Tooltip content="Run the open fixes with an agent">
                  <Button
                    size="small"
                    onClick={() => plan.id && launchRunAll(plan.id)}
                    disabled={agentBusy}
                  >
                    {agentBusy ? 'Running…' : 'Run fixes'}
                  </Button>
                </Tooltip>
              )}
            </>
          ),
        }}
        panelFooter={
          rows.length === 0 ? (
            // Table has no empty-body slot, so the invitation rides in the footer —
            // with no rows above it, it lands directly under the header either way.
            <div className="flex justify-center py-6">
              <DraftPlanButton
                idea={ideaView}
                otherPlans={otherPlans}
                className="font-handwritten !text-base underline"
              />
            </div>
          ) : (
            deliverPanel
          )
        }
        columns={[
          {
            key: 'checkbox',
            header: '',
            cell: (row: WorkRow) => (
              <PhaseCheckboxCell
                row={row}
                runningFill={runningFill}
                updating={updating}
                onTogglePhase={onTogglePhase}
                onToggleFix={onToggleFix}
              />
            ),
            width: 1,
          },
          {
            key: 'title',
            header: 'Title',
            cell: (row: WorkRow) => <PhaseTitleCell row={row} runningFill={runningFill} />,
          },
          {
            key: 'actions',
            header: '',
            align: 'end',
            width: 6,
            cell: (row: WorkRow) => (
              <PhaseActionsCell
                row={row}
                runningFill={runningFill}
                agentBusy={agentBusy}
                planId={plan.id}
              />
            ),
          },
        ]}
        expandable={{
          render: (row: WorkRow) => {
            const runSummary = row.item.run ? formatRunSummary(row.item.run) : null;
            if (!row.item.description && !runSummary) return null;
            return (
              <div className="flex flex-col gap-1">
                {row.item.description && <span>{row.item.description}</span>}
                {runSummary && (
                  <span className="font-mono text-3xs opacity-[0.7]">{runSummary}</span>
                )}
              </div>
            );
          },
        }}
        hideHeader
        density="compact"
        showExpandColumn={false}
        rowTexture={(row: WorkRow) => {
          if (row.kind === 'fix') return 'kraft';
          if (row.kind === 'phase' && row.item.done) return 'canvas';
          return undefined;
        }}
        rowClassName={(row: WorkRow) => {
          if (isRunningRow(row, runningFill)) return 'phase-running-row';
          if (row.kind === 'phase' && row.item.source === 'review') {
            return 'bg-[rgba(155,122,181,0.08)]';
          }
          return undefined;
        }}
        className="phase-table-phone"
      />
    </div>
  );
};
