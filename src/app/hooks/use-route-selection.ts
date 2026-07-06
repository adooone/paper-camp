import { useParams } from '@tanstack/react-router';

export const DOC_SECTIONS = ['decisions', 'questions', 'progress', 'repo-docs'] as const;
export type DocSection = (typeof DOC_SECTIONS)[number];

/** The plan title selected via the `/plans/$planId` or `/review/$planId` route param. */
export function useActivePlanTitle(): string | null {
  const { planId } = useParams({ strict: false });
  return typeof planId === 'string' ? decodeURIComponent(planId) : null;
}

/** The idea title selected via the `/ideas/$ideaId` route param. */
export function useActiveIdeaTitle(): string | null {
  const { ideaId } = useParams({ strict: false });
  return typeof ideaId === 'string' ? decodeURIComponent(ideaId) : null;
}

/** The docs section selected via the `/docs/$section` route param. */
export function useActiveDocSection(): DocSection | null {
  const { section } = useParams({ strict: false });
  return DOC_SECTIONS.includes(section as DocSection) ? (section as DocSection) : null;
}
