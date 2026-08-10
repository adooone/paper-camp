import type { DoctorFindingSummary } from '@/core/doctor';
import type {
  ConsistencyIssue,
  ResolvedRoadmap,
  RoadmapItem,
  SuggestionEntry,
  TaskLogEntry,
} from '@/types/index';
import { apiUrl } from '../api-base';

export const fetchTaskLog = async () => {
  const res = await fetch(apiUrl('/api/tasks'));
  return res.json() as Promise<{ entries: TaskLogEntry[] }>;
};

export const fetchTaskLogLines = async (id: string) => {
  const res = await fetch(apiUrl(`/api/tasks/output?id=${encodeURIComponent(id)}`));
  if (!res.ok) throw new Error(`Failed to fetch task log: ${res.status}`);
  return res.json() as Promise<{ lines: string[] }>;
};

export const fetchSuggestions = async () => {
  const res = await fetch(apiUrl('/api/suggestions'));
  return res.json() as Promise<{ entries: SuggestionEntry[] }>;
};

export const promoteSuggestion = async (suggestion: SuggestionEntry) => {
  const res = await fetch(apiUrl('/api/suggestions/promote'), {
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
  const res = await fetch(apiUrl('/api/suggestions/dismiss'), {
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
  const res = await fetch(apiUrl('/api/docs'));
  return res.json() as Promise<{ files: { name: string; content: string }[] }>;
};

export const fetchRoadmap = async () => {
  const res = await fetch(apiUrl('/api/roadmap'));
  if (!res.ok) throw new Error(`Failed to fetch roadmap: ${res.status}`);
  return res.json() as Promise<ResolvedRoadmap | null>;
};

export const promoteRoadmapItem = async (
  horizonTitle: string,
  item: RoadmapItem,
  subject?: string,
  candidateName?: string,
) => {
  const res = await fetch(apiUrl('/api/roadmap/promote'), {
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

export const addRoadmapItem = async (horizonTitle: string, name: string, description: string) => {
  const res = await fetch(apiUrl('/api/roadmap/items'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizonTitle, name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to add roadmap item' }));
    throw new Error(err.error);
  }
};

export const addRoadmapCandidate = async (horizonTitle: string, itemName: string, name: string) => {
  const res = await fetch(apiUrl('/api/roadmap/candidates'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizonTitle, itemName, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to add roadmap candidate' }));
    throw new Error(err.error);
  }
};

export const fetchConsistency = async () => {
  const res = await fetch(apiUrl('/api/consistency'));
  return res.json() as Promise<ConsistencyIssue[]>;
};

export const fetchDoctor = async () => {
  const res = await fetch(apiUrl('/api/doctor'));
  return res.json() as Promise<DoctorFindingSummary>;
};
