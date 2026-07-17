import { useAppStore } from '@/app/stores/app-store';
import { useParams } from '@tanstack/react-router';

const DOC_SECTIONS = ['decisions', 'questions', 'progress', 'repo-docs'] as const;
type DocSection = (typeof DOC_SECTIONS)[number];

export function useActivePlanTitle(): string | null {
  const { planId } = useParams({ strict: false });
  return typeof planId === 'string' ? decodeURIComponent(planId) : null;
}

export function useActiveIdeaTitle(): string | null {
  const { ideaId } = useParams({ strict: false });
  return typeof ideaId === 'string' ? decodeURIComponent(ideaId) : null;
}

function useActiveDocSection(): DocSection | null {
  const { section } = useParams({ strict: false });
  return DOC_SECTIONS.includes(section as DocSection) ? (section as DocSection) : null;
}

// For bare `/docs` with no section, falls back to the pre-selected repo doc
// (MAIN.md or README.md; see loadRepoDocs) so `/docs` lands on content, not a placeholder.
export function useResolvedDocSection(): DocSection | null {
  const routeSection = useActiveDocSection();
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const repoDocs = useAppStore((s) => s.repoDocs);
  return (
    routeSection ??
    (activeDocTitle && repoDocs.some((f) => f.name === activeDocTitle) ? 'repo-docs' : null)
  );
}
