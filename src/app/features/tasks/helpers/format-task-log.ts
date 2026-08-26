import type { TaskLogEntry } from '@/types/index';

export interface TaskGroup {
  key: string;
  entries: TaskLogEntry[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDayHeader = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
