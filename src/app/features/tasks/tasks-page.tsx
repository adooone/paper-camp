import { PageTitle } from '@/app/components/page-title';
import { fetchTaskLogLines } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { AGENT_LABELS, type TaskKind, type TaskLogEntry } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
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

const pad = (n: number) => String(n).padStart(2, '0');

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDayHeader = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const headerLabelStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: 600,
  opacity: 0.6,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const TaskLogLines = ({ id }: { id: string }) => {
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    setLines(null);
    fetchTaskLogLines(id)
      .then((data) => setLines(data.lines))
      .catch(() => setLines([]));
  }, [id]);

  if (lines === null) return <p style={{ opacity: 0.5, margin: 0 }}>Loading…</p>;
  if (lines.length === 0) return <p style={{ opacity: 0.5, margin: 0 }}>No output recorded.</p>;
  return (
    <pre
      style={{
        fontFamily: fontFamily.mono,
        fontSize: fontSize.xs,
        margin: 0,
        maxHeight: 320,
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
      }}
    >
      {lines.join('\n')}
    </pre>
  );
};

const ChevronRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const TaskRow = ({ entry, highlighted }: { entry: TaskLogEntry; highlighted: boolean }) => {
  const [expanded, setExpanded] = useState(highlighted);
  useEffect(() => {
    if (highlighted) setExpanded(true);
  }, [highlighted]);
  const toggle = () => setExpanded((v) => !v);

  return (
    <div
      className={highlighted ? 'task-row-highlighted' : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: space[1], borderRadius: 10 }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: the clickable row wraps a Card whose block layout a native <button> would break; keyboard toggling is wired on the div. */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        style={{ cursor: 'pointer', borderRadius: 10 }}
      >
        <Card size="small" texture="canvas" className="plan-row-card">
          <div className="task-rows-grid">
            <span
              className="task-rows-chevron"
              aria-expanded={expanded}
              style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.5 }}
            >
              <ChevronRightIcon />
            </span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {TASK_KIND_LABELS[entry.taskKind]}
            </span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: 0.7,
              }}
            >
              {entry.planTitle}
            </span>
            <span className="text-sm" style={{ opacity: 0.5, whiteSpace: 'nowrap' }}>
              {AGENT_LABELS[entry.agentId]}
            </span>
            <span
              className="task-rows-cell-time"
              style={{
                fontFamily: fontFamily.mono,
                fontSize: fontSize.xs,
                opacity: 0.55,
                whiteSpace: 'nowrap',
              }}
            >
              {formatTime(entry.startedAt)}–{formatTime(entry.endedAt)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Stamp
                size="small"
                fillColor={
                  entry.outcome === 'done'
                    ? 'rgba(143, 185, 150, 0.25)'
                    : 'rgba(201, 139, 139, 0.25)'
                }
                textColor={entry.outcome === 'done' ? color.accentGreenDark : color.accentRoseDark}
              >
                {entry.outcome}
              </Stamp>
            </div>
          </div>
        </Card>
      </div>
      {expanded && (
        <Card size="small" texture="kraft" className="plan-row-card">
          <TaskLogLines id={entry.id} />
        </Card>
      )}
    </div>
  );
};

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

  const groups: { key: string; entries: TaskLogEntry[] }[] = [];
  for (const entry of sorted) {
    const key = dayKey(entry.endedAt);
    const group = groups.at(-1);
    if (group?.key === key) group.entries.push(entry);
    else groups.push({ key, entries: [entry] });
  }

  return (
    <div ref={containerRef}>
      <PageTitle>Tasks</PageTitle>
      {taskLogLoading && <p style={{ opacity: 0.5 }}>Loading…</p>}
      {!taskLogLoading && sorted.length === 0 && (
        <p style={{ opacity: 0.5 }}>No tasks have run yet.</p>
      )}
      {!taskLogLoading && sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
          <Card size="small" texture="kraft" className="plan-row-card">
            <div className="task-rows-grid">
              <span />
              <span style={headerLabelStyle}>Task</span>
              <span style={headerLabelStyle}>Plan</span>
              <span style={headerLabelStyle}>Agent</span>
              <span className="task-rows-cell-time" style={headerLabelStyle}>
                Time
              </span>
              <span style={headerLabelStyle}>Outcome</span>
            </div>
          </Card>
          {groups.map((group) => (
            <div
              key={group.key}
              style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}
            >
              <Card size="small" texture="kraft" className="plan-row-card">
                <span style={{ ...headerLabelStyle, opacity: 0.75 }}>
                  {formatDayHeader(group.entries[0].endedAt)}
                </span>
              </Card>
              {group.entries.map((entry) => (
                <TaskRow key={entry.id} entry={entry} highlighted={entry.id === taskId} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
