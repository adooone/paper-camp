import { useAppStore } from '@/app/stores/app-store';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { useParams } from '@tanstack/react-router';

const DOC_SECTIONS = ['repo-docs', 'release-notes'] as const;
type DocSection = (typeof DOC_SECTIONS)[number];

const SETTINGS_SECTIONS = ['subjects', 'setup', 'merge-policy'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

// id is the routing key; an id-less entry (the legacy case its optional type
// still allows) falls back to matching by title, exactly as before ids existed.
export function resolveByIdOrTitle<T extends { id?: string | null; title: string }>(
  entries: T[],
  routeParam: string,
): T | null {
  return (
    entries.find((entry) => entry.id === routeParam) ??
    entries.find((entry) => !entry.id && entry.title === routeParam) ??
    null
  );
}

export function useActivePlan(): PlanEntry | null {
  const { planId } = useParams({ strict: false });
  const plans = useAppStore((s) => s.plans);
  if (typeof planId !== 'string' || !plans) return null;
  return resolveByIdOrTitle(plans.entries, decodeURIComponent(planId));
}

export function useActiveIdea(): IdeaEntry | null {
  const { ideaId } = useParams({ strict: false });
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  if (typeof ideaId !== 'string') return null;
  return resolveByIdOrTitle(ideaEntries, decodeURIComponent(ideaId));
}

function useActiveDocSection(): DocSection | null {
  const { section } = useParams({ strict: false });
  return DOC_SECTIONS.includes(section as DocSection) ? (section as DocSection) : null;
}

/** null means the bare `/settings` general section. */
export function useActiveSettingsSection(): SettingsSection | null {
  const { section } = useParams({ strict: false });
  return SETTINGS_SECTIONS.includes(section as SettingsSection)
    ? (section as SettingsSection)
    : null;
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
