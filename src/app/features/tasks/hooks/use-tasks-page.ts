import { useAppStore } from '@/app/stores/app-store';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { type TaskGroup, dayKey } from '../helpers';

export const useTasksPage = () => {
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

  const groups: TaskGroup[] = [];
  for (const entry of sorted) {
    const key = dayKey(entry.endedAt);
    const group = groups.at(-1);
    if (group?.key === key) group.entries.push(entry);
    else groups.push({ key, entries: [entry] });
  }

  return { taskLogLoading, groups, taskId, containerRef };
};
