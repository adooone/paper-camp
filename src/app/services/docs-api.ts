import type { DecisionEntry, OpenQuestionEntry, ProgressEntry } from '@/types/index';

export const fetchDecisions = async () => {
  const res = await fetch('/api/decisions');
  return res.json() as Promise<{ entries: DecisionEntry[]; warnings: { title: string; message: string }[] }>;
};

export const fetchOpenQuestions = async () => {
  const res = await fetch('/api/open-questions');
  return res.json() as Promise<{ entries: OpenQuestionEntry[]; warnings: { title: string; message: string }[] }>;
};

export const fetchProgress = async () => {
  const res = await fetch('/api/progress');
  return res.json() as Promise<{ entries: ProgressEntry[] }>;
};

export const fetchRepoDocs = async () => {
  const res = await fetch('/api/docs');
  return res.json() as Promise<{ files: { name: string; content: string }[] }>;
};
