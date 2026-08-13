import { PageTitle } from '@/app/components/page-title';
import { fetchTaskLogLines } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { AGENT_LABELS, type TaskKind, type TaskLogEntry } from '@/types/index';
import { Button, Card, Stamp } from '@dendelion/paper-ui';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

const TASK_KIND_LABELS: Record<TaskKind, string> = {
  phase: 'Phase run',
  audit: 'Audit',
  'batch-reconcile': 'Batch reconcile',
  'batch-draft': 'Batch draft',
  'run-all': 'Run all phases',
  draft: 'Draft',
  extend: 'Extend',
  suggest: 'Suggest ideas',
  'commit-suggest': 'Commit suggest',
  'overlap-check': 'Overlap check',
  prioritise: 'Prioritise queue',
  sync: 'Sync',
  reconcile: 'Reconcile',
  'fix-review': 'Fix review',
  'resolve-conflict': 'Resolve conflict',
  feedback: 'Feedback reply',
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

const headerLabelClassName = 'text-sm font-semibold whitespace-nowrap overflow-hidden';

const TASK_ROWS_GRID_CLASS =
  'grid grid-cols-[20px_116px_minmax(0,1fr)_88px_150px_72px] gap-2.5 items-center max-lg:grid-cols-[20px_116px_minmax(0,1fr)_88px_72px] max-[480px]:grid-cols-1 max-[480px]:gap-1';

const TaskLogLines = ({ id }: { id: string }) => {
  const [lines, setLines] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the retry trigger (re-runs the fetch), not a value read in the body.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLines(null);
    setFailed(false);
    // Auto-retry first (dev server briefly drops requests on hot reload); manual Retry only if it stays down.
    const load = (remaining: number) => {
      fetchTaskLogLines(id)
        .then((data) => {
          if (cancelled) return;
          setLines(data.lines ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          if (remaining > 0) {
            timer = setTimeout(() => load(remaining - 1), 700);
            return;
          }
          // Empty result != failed request: conflating them mislabels a fetch error as "no output".
          setFailed(true);
          setLines([]);
        });
    };
    load(3);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, attempt]);

  const retry = (
    <Button variant="ghost" size="small" onClick={() => setAttempt((n) => n + 1)}>
      Retry
    </Button>
  );

  if (lines === null) return <p className="opacity-50 m-0">Loading…</p>;
  if (failed)
    return (
      <div className="flex items-center gap-2">
        <p className="opacity-50 m-0">Couldn't load this task's output.</p>
        {retry}
      </div>
    );
  if (lines.length === 0)
    return (
      <div className="flex items-center gap-2">
        <p className="opacity-50 m-0">No output recorded.</p>
        {retry}
      </div>
    );
  return (
    <pre className="font-mono text-xs m-0 max-h-[320px] overflow-y-auto whitespace-pre-wrap">
      {lines.join('\n')}
    </pre>
  );
};

const ChevronRightIcon = ({ size = 14, className }: { size?: number; className?: string }) => (
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
    className={className}
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
      className={
        highlighted
          ? 'task-row-highlighted flex flex-col gap-1 rounded-[10px] outline outline-2 outline-offset-[-2px] outline-[rgba(200,154,90,0.5)]'
          : 'flex flex-col gap-1 rounded-[10px]'
      }
    >
      {/* biome-ignore lint/a11y/useSemanticElements: the clickable row wraps a Card whose block layout a native <button> would break; keyboard toggling is wired on the div. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className="group cursor-pointer rounded-[10px]"
      >
        <Card size="small" texture="canvas" className="plan-row-card">
          <div className={TASK_ROWS_GRID_CLASS}>
            <span className="inline-flex items-center opacity-50">
              <ChevronRightIcon className="group-aria-expanded:rotate-90" />
            </span>
            <span className="font-semibold whitespace-nowrap overflow-hidden">
              {TASK_KIND_LABELS[entry.taskKind] ?? entry.taskKind}
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap opacity-70">
              {entry.planTitle}
            </span>
            <span className="text-sm opacity-50 whitespace-nowrap">
              {AGENT_LABELS[entry.agentId]}
            </span>
            <span className="max-lg:hidden font-mono text-xs opacity-[0.55] whitespace-nowrap">
              {formatTime(entry.startedAt)}–{formatTime(entry.endedAt)}
            </span>
            <div className="flex items-center">
              <Stamp
                size="small"
                fillColor={
                  entry.outcome === 'done'
                    ? 'rgba(143, 185, 150, 0.25)'
                    : entry.outcome === 'superseded'
                      ? 'rgba(212, 163, 115, 0.25)'
                      : 'rgba(201, 139, 139, 0.25)'
                }
                textColor={
                  entry.outcome === 'done'
                    ? color.accentGreenDark
                    : entry.outcome === 'superseded'
                      ? color.accentAmberDark
                      : color.accentRoseDark
                }
              >
                {entry.outcome}
              </Stamp>
            </div>
          </div>
        </Card>
      </div>
      {expanded && (
        <Card size="small" texture="kraft" className="plan-row-card">
          {entry.outcome === 'error' && entry.reason && (
            <p className="m-0 mb-2 text-sm text-state-danger">{entry.reason}</p>
          )}
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
      {taskLogLoading && <p className="opacity-50">Loading…</p>}
      {!taskLogLoading && sorted.length === 0 && (
        <p className="opacity-50">No tasks have run yet.</p>
      )}
      {!taskLogLoading && sorted.length > 0 && (
        <div className="flex flex-col gap-1">
          <Card size="small" texture="kraft" className="plan-row-card">
            <div className={TASK_ROWS_GRID_CLASS}>
              <span />
              <span className={`${headerLabelClassName} opacity-60`}>Task</span>
              <span className={`${headerLabelClassName} opacity-60`}>Plan</span>
              <span className={`${headerLabelClassName} opacity-60`}>Agent</span>
              <span className={`max-lg:hidden ${headerLabelClassName} opacity-60`}>Time</span>
              <span className={`${headerLabelClassName} opacity-60`}>Outcome</span>
            </div>
          </Card>
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-1">
              <Card size="small" texture="kraft" className="plan-row-card">
                <span className={`${headerLabelClassName} opacity-75`}>
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
