import { PageTitle } from '@/app/components/page-title';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily } from '@/app/styles/tokens';
import { AGENT_LABELS, type TaskKind, type TaskLogEntry } from '@/types/index';
import { Stamp, Table } from '@dendelion/paper-ui';
import { useEffect } from 'react';

const TASK_KIND_LABELS: Record<TaskKind, string> = {
  phase: 'Phase run',
  audit: 'Audit',
  'batch-reconcile': 'Batch reconcile',
  'run-all': 'Run all phases',
  draft: 'Draft',
  extend: 'Extend',
  suggest: 'Suggest ideas',
  'commit-suggest': 'Commit suggest',
  'overlap-check': 'Overlap check',
  sync: 'Sync',
  reconcile: 'Reconcile',
  'fix-review': 'Fix review',
};

const formatTimestamp = (iso: string) => new Date(iso).toLocaleString();

const outcomeStamp = (outcome: TaskLogEntry['outcome']) => (
  <Stamp
    size="small"
    fillColor={outcome === 'done' ? 'rgba(143, 185, 150, 0.25)' : 'rgba(201, 139, 139, 0.25)'}
    textColor={outcome === 'done' ? color.accentGreenDark : color.accentRoseDark}
  >
    {outcome}
  </Stamp>
);

export const TasksPage = () => {
  const taskLog = useAppStore((s) => s.taskLog);
  const taskLogLoading = useAppStore((s) => s.taskLogLoading);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const sorted = [...taskLog].sort((a, b) => b.endedAt.localeCompare(a.endedAt));

  return (
    <div>
      <PageTitle>Tasks</PageTitle>
      {taskLogLoading && <p style={{ opacity: 0.5 }}>Loading…</p>}
      {!taskLogLoading && sorted.length === 0 && (
        <p style={{ opacity: 0.5 }}>No tasks have run yet.</p>
      )}
      {!taskLogLoading && sorted.length > 0 && (
        <Table
          data={sorted}
          columns={[
            {
              key: 'taskKind',
              header: 'Task',
              cell: (row: TaskLogEntry) => TASK_KIND_LABELS[row.taskKind],
            },
            {
              key: 'planTitle',
              header: 'Plan',
              cell: (row: TaskLogEntry) => row.planTitle,
            },
            {
              key: 'agentId',
              header: 'Agent',
              cell: (row: TaskLogEntry) => AGENT_LABELS[row.agentId],
            },
            {
              key: 'startedAt',
              header: 'Started',
              cell: (row: TaskLogEntry) => (
                <span style={{ fontFamily: fontFamily.mono }}>
                  {formatTimestamp(row.startedAt)}
                </span>
              ),
            },
            {
              key: 'endedAt',
              header: 'Ended',
              cell: (row: TaskLogEntry) => (
                <span style={{ fontFamily: fontFamily.mono }}>{formatTimestamp(row.endedAt)}</span>
              ),
            },
            {
              key: 'outcome',
              header: 'Outcome',
              cell: (row: TaskLogEntry) => outcomeStamp(row.outcome),
            },
          ]}
        />
      )}
    </div>
  );
};
