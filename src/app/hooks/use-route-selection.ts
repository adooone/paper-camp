import { useAppStore } from '@/app/stores/app-store';
import { useParams } from '@tanstack/react-router';

const DOC_SECTIONS = ['decisions', 'questions', 'progress', 'repo-docs'] as const;
type DocSection = (typeof DOC_SECTIONS)[number];

/** The plan title selected via the `/plans/$planId` route param. */
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
function useActiveDocSection(): DocSection | null {
  const { section } = useParams({ strict: false });
  return DOC_SECTIONS.includes(section as DocSection) ? (section as DocSection) : null;
}

/**
 * The resolved docs section: the route section, or — for bare `/docs` with no
 * section — the pre-selected repo doc (MAIN.md or README.md, whichever the repo
 * has; see `loadRepoDocs`), so `/docs` lands on content instead of the
 * placeholder. Shared by `DocsPage` and `DocsSidebar`.
 */
export function useResolvedDocSection(): DocSection | null {
  const routeSection = useActiveDocSection();
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const repoDocs = useAppStore((s) => s.repoDocs);
  return (
    routeSection ??
    (activeDocTitle && repoDocs.some((f) => f.name === activeDocTitle) ? 'repo-docs' : null)
  );
}
