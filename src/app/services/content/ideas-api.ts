import type { SimilarityCandidate } from '@/app/features/plans/helpers';
import { apiUrl } from '@/app/services/api-base';
import type { ArchivableIdea, IdeaEntry, OverlapVerdict, ParseResult } from '@/types/index';

export interface PrioritiseResult {
  ok: boolean;
  moved: string[];
  annotated: string[];
  why: string;
  annotationError?: string;
}

const IDEAS_TIMEOUT_MS = 45_000;

export const fetchIdeas = async (): Promise<ParseResult<IdeaEntry>> => {
  const response = await fetch(apiUrl('/api/ideas'), {
    signal: AbortSignal.timeout(IDEAS_TIMEOUT_MS),
  });
  return response.json();
};

export const fetchArchivableIdeas = async (): Promise<ArchivableIdea[]> => {
  const response = await fetch(apiUrl('/api/archivable-ideas'));
  return response.json();
};

export const archiveIdeas = async (ids: string[]): Promise<{ archived: string[] }> => {
  const response = await fetch(apiUrl('/api/ideas/archive'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to archive ideas');
  return data as { archived: string[] };
};

export const createIdea = async (idea: {
  title: string;
  content?: string;
  kind?: 'idea' | 'note';
}): Promise<string> => {
  const response = await fetch(apiUrl('/api/ideas'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idea),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to create idea');
  return data.id as string;
};

export const checkIdeaOverlap = async (
  text: string,
  candidates: SimilarityCandidate[],
): Promise<OverlapVerdict> => {
  const response = await fetch(apiUrl('/api/ideas/check-overlap'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, candidates }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to check overlap');
  return data as OverlapVerdict;
};

export const prioritiseQueue = async (): Promise<PrioritiseResult> => {
  const response = await fetch(apiUrl('/api/ideas/prioritise'), { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to prioritise queue');
  return data as PrioritiseResult;
};
