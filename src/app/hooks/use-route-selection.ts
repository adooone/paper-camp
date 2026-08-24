import { useAppStore } from '@/app/stores/app-store';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { useParams } from '@tanstack/react-router';

const DOC_SECTIONS = ['repo-docs', 'release-notes'] as const;
type DocSection = (typeof DOC_SECTIONS)[number];

const SETTINGS_SECTIONS = ['subjects', 'setup', 'merge-policy'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

// URLs carry bare numbers, never prefixed ids: /ideas/195, /ideas/195/tickets/2. A number
// alone can't distinguish TICKET-2 from IDEA-2, so the route shape does — not the id.
export function bareId(id: string | null | undefined): string | null {
  return id?.match(/\d+$/)?.[0] ?? null;
}

const NUMERIC_PARAM = /^\d+$/;

// id is the routing key; an id-less entry (the legacy case its optional type
// still allows) falls back to matching by title, exactly as before ids existed.
export function resolveByIdOrTitle<T extends { id?: string | null; title: string }>(
  entries: T[],
  routeParam: string,
  prefix = 'IDEA',
): T | null {
  if (NUMERIC_PARAM.test(routeParam)) {
    const byId = entries.find(
      (entry) => entry.id?.toUpperCase() === `${prefix}-${routeParam}`.toUpperCase(),
    );
    if (byId) return byId;
  }
  // Pre-id entries, and the full-id links a previous routing scheme emitted.
  const param = routeParam.toUpperCase();
  return (
    entries.find((entry) => entry.id?.toUpperCase() === param) ??
    entries.find((entry) => !entry.id && entry.title === routeParam) ??
    null
  );
}

// Link builders' counterpart to resolveByIdOrTitle: bare numeric id when present,
// URL-encoded title as the id-less fallback.
export function entityRouteParam(id: string | null | undefined, title: string): string {
  return bareId(id) ?? encodeURIComponent(title);
}

export type EntityLink =
  | { to: '/ideas/$ideaId'; params: { ideaId: string } }
  | { to: '/ideas/$ideaId/tickets/$ticketId'; params: { ideaId: string; ticketId: string } };

/** The one place an entity becomes a URL. A ticket minted as `TICKET-N` nests under
 *  its board so the number stays unambiguous; an idea promoted onto a board kept its
 *  own id (IDEA-201) and so keeps its own `/ideas/:n` address. */
export function entityLink(entity: {
  id?: string | null;
  title: string;
  entityKind?: string;
  idea?: string;
}): EntityLink {
  const ticketNumber = entity.id?.startsWith('TICKET-') ? bareId(entity.id) : null;
  const boardNumber = bareId(entity.idea);
  if (entity.entityKind === 'ticket' && ticketNumber && boardNumber) {
    return {
      to: '/ideas/$ideaId/tickets/$ticketId',
      params: { ideaId: boardNumber, ticketId: ticketNumber },
    };
  }
  return { to: '/ideas/$ideaId', params: { ideaId: entityRouteParam(entity.id, entity.title) } };
}

export function useActivePlan(): PlanEntry | null {
  const { planId, ideaId, ticketId } = useParams({ strict: false });
  const plans = useAppStore((s) => s.plans);
  if (!plans) return null;
  if (typeof ticketId === 'string') {
    return resolveByIdOrTitle(plans.entries, decodeURIComponent(ticketId), 'TICKET');
  }
  // `/ideas/:n` serves both — a plan-bearing idea resolves here, a note falls through
  // to useActiveIdea below.
  const param = typeof ideaId === 'string' ? ideaId : planId;
  if (typeof param !== 'string') return null;
  return resolveByIdOrTitle(plans.entries, decodeURIComponent(param));
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
