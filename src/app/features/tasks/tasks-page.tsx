import { PageTitle } from '@/app/components/page-title';
import { fetchTaskLogLines } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { AGENT_LABELS, type TaskKind, type TaskLogEntry } from '@/types/index';
import { Stamp, Table } from '@dendelion/paper-ui';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

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

// Fetches its own row's persisted output lazily, only once a row is expanded —
// the Tasks page never has the full history's output loaded at once.
const TaskLogLines = ({ id }: { id: string }) => {
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    setLines(null);
    fetchTaskLogLines(id)
      .then((data) => setLines(data.lines))
      .catch(() => setLines([]));
  }, [id]);

  if (lines === null) return <p style={{ opacity: 0.5 }}>Loading…</p>;
  if (lines.length === 0) return <p style={{ opacity: 0.5 }}>No output recorded.</p>;
  return (
    <pre
      style={{
        fontFamily: fontFamily.mono,
        fontSize: fontSize.sm,
        margin: 0,
        padding: space[3],
        whiteSpace: 'pre-wrap',
      }}
    >
      {lines.join('\n')}
    </pre>
  );
};

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
  const { taskId } = useSearch({ from: '/tasks' });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  useEffect(() => {
    if (!taskId) return;
    const row = containerRef.current?.querySelector('.task-row-highlighted');
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [taskId]);

  const sorted = [...taskLog].sort((a, b) => b.endedAt.localeCompare(a.endedAt));

  return (
    <div ref={containerRef}>
      <PageTitle>Tasks</PageTitle>
      {taskLogLoading && <p style={{ opacity: 0.5 }}>Loading…</p>}
      {!taskLogLoading && sorted.length === 0 && (
        <p style={{ opacity: 0.5 }}>No tasks have run yet.</p>
      )}
      {!taskLogLoading && sorted.length > 0 && (
        <Table
          data={sorted}
          rowKey={(row: TaskLogEntry) => row.id}
          rowClassName={(row: TaskLogEntry) =>
            row.id === taskId ? 'task-row-highlighted' : undefined
          }
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
          expandable={{
            render: (row: TaskLogEntry) => <TaskLogLines id={row.id} />,
          }}
        />
      )}
    </div>
  );
};
