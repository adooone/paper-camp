import type { ResolvedIdea } from '@/types/index';

export const ideaProgressLabel = (idea: ResolvedIdea): string => {
  if (idea.phases.length === 0) return 'drafted';
  const done = idea.phases.filter((phase) => phase.done).length;
  return `${done} / ${idea.phases.length}`;
};
