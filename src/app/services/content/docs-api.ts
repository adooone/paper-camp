import type {
  ConsistencyIssue,
  DecisionEntry,
  OpenQuestionEntry,
  ProgressEntry,
} from '@/types/index';

export const fetchDecisions = async () => {
  const res = await fetch('/api/decisions');
  return res.json() as Promise<{
    entries: DecisionEntry[];
    warnings: { title: string; message: string }[];
  }>;
};

export const fetchOpenQuestions = async () => {
  const res = await fetch('/api/open-questions');
  return res.json() as Promise<{
    entries: OpenQuestionEntry[];
    warnings: { title: string; message: string }[];
  }>;
};

export const fetchProgress = async () => {
  const res = await fetch('/api/progress');
  return res.json() as Promise<{ entries: ProgressEntry[] }>;
};

export const fetchRepoDocs = async () => {
  const res = await fetch('/api/docs');
  return res.json() as Promise<{ files: { name: string; content: string }[] }>;
};

export const fetchConsistency = async () => {
  const res = await fetch('/api/consistency');
  return res.json() as Promise<ConsistencyIssue[]>;
};

export const resolveOpenQuestion = async (title: string, decision: string, rationale?: string) => {
  const res = await fetch(`/api/open-questions/resolve?title=${encodeURIComponent(title)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, rationale }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Failed to resolve open question');
  }
  return res.json() as Promise<{ ok: boolean }>;
};
