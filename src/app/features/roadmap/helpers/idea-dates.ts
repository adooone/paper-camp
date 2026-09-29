import type { ResolvedIdea } from '@/types/index';

export interface IdeaDateRange {
  since?: string;
  lastIdea?: string;
}

export const ideaDateRange = (ideas: ResolvedIdea[]): IdeaDateRange => {
  const dates = ideas.map((idea) => idea.created).sort();
  if (dates.length === 0) return {};
  return { since: dates[0], lastIdea: dates[dates.length - 1] };
};

export const formatFactDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? dateStr : date.toLocaleDateString();
};
