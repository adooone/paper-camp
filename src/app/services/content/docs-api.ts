import type {
  ConsistencyIssue,
  Roadmap,
  RoadmapItem,
  SuggestionEntry,
  TaskLogEntry,
} from '@/types/index';

export const fetchTaskLog = async () => {
  const res = await fetch('/api/tasks');
  return res.json() as Promise<{ entries: TaskLogEntry[] }>;
};

export const fetchTaskLogLines = async (id: string) => {
  const res = await fetch(`/api/tasks/log?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch task log: ${res.status}`);
  return res.json() as Promise<{ lines: string[] }>;
};

export const fetchSuggestions = async () => {
  const res = await fetch('/api/suggestions');
  return res.json() as Promise<{ entries: SuggestionEntry[] }>;
};

export const promoteSuggestion = async (suggestion: SuggestionEntry) => {
  const res = await fetch('/api/suggestions/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suggestion }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to promote suggestion' }));
    throw new Error(err.error);
  }
  return res.json() as Promise<{ ok: boolean; id: string }>;
};

export const dismissSuggestion = async (suggestion: SuggestionEntry) => {
  const res = await fetch('/api/suggestions/dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suggestion }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to dismiss suggestion' }));
    throw new Error(err.error);
  }
};

export const fetchRepoDocs = async () => {
  const res = await fetch('/api/docs');
  return res.json() as Promise<{ files: { name: string; content: string }[] }>;
};

export const fetchRoadmap = async () => {
  const res = await fetch('/api/roadmap');
  if (!res.ok) throw new Error(`Failed to fetch roadmap: ${res.status}`);
  return res.json() as Promise<Roadmap | null>;
};

export const promoteRoadmapItem = async (
  horizonTitle: string,
  item: RoadmapItem,
  subject?: string,
  candidateName?: string,
) => {
  const res = await fetch('/api/roadmap/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizonTitle, item, subject, candidateName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to promote roadmap item' }));
    throw new Error(err.error);
  }
  return res.json() as Promise<{ ok: boolean; id: string }>;
};

export const fetchConsistency = async () => {
  const res = await fetch('/api/consistency');
  return res.json() as Promise<ConsistencyIssue[]>;
};
