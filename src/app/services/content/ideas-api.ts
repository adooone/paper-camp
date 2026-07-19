import type { SimilarityCandidate } from '@/app/features/plans/helpers';
import type { ArchivableIdea, IdeaEntry, OverlapVerdict, ParseResult } from '@/types/index';

export const fetchIdeas = async (): Promise<ParseResult<IdeaEntry>> => {
  const response = await fetch('/api/ideas');
  return response.json();
};

export const fetchArchivableIdeas = async (): Promise<ArchivableIdea[]> => {
  const response = await fetch('/api/archivable-ideas');
  return response.json();
};

export const archiveIdeas = async (ids: string[]): Promise<{ archived: string[] }> => {
  const response = await fetch('/api/ideas/archive', {
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
  const response = await fetch('/api/ideas', {
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
  const response = await fetch('/api/ideas/check-overlap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, candidates }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to check overlap');
  return data as OverlapVerdict;
};
