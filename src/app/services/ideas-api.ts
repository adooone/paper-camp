import type { IdeaEntry, ParseResult } from '@/types/index';

export const fetchIdeas = async (): Promise<ParseResult<IdeaEntry>> => {
  const response = await fetch('/api/ideas');
  return response.json();
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
