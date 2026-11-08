import type {
  EntityDetailEntry,
  EntityEntry,
  IdeaEntry,
  IdeaStatus,
  PlanEntry,
  PlanStatus,
  PrInfo,
} from '../types/index';
import { deriveStatus, isStatusFallback } from './status';
import {
  clarificationsFromThread,
  logFromThread,
  notesFromThread,
  reviewFromThread,
} from './thread';

/** Status is derived via deriveStatus, not read from `e.status` — that field stays the
 * raw stored override so round-tripping an EntityEntry back to disk never persists a derived value. */
export function entityToPlan(
  e: EntityEntry,
  pr?: PrInfo,
  prLookupResolved = false,
  hasMainActivity = false,
): PlanEntry {
  return {
    title: e.title,
    // Non-note entities can't carry the note-only 'open' (schema-enforced).
    status: deriveStatus(e, pr, prLookupResolved, hasMainActivity) as PlanStatus,
    statusFallback: isStatusFallback(e, pr, prLookupResolved),
    kind: e.type,
    entityKind: e.kind === 'note' ? undefined : e.kind,
    id: e.id,
    idea: e.idea,
    agent: e.agent,
    created: e.created,
    updated: e.updated,
    audited: e.audited,
    auditedHash: e.auditedHash,
    released: e.released,
    tags: e.tags,
    needs: e.needs,
    subject: e.subject,
    order: e.order,
    issueSource: e.issueSource,
    body: e.body,
    phases: e.phases,
    fixes: e.fixes,
    log: logFromThread(e.thread),
    clarifications: clarificationsFromThread(e.thread),
    notes: notesFromThread(e.thread),
    review: reviewFromThread(e.thread),
    thread: e.thread,
    archived: e.archived,
    pr,
    assets: e.assets,
  };
}

export function entityToIdea(e: EntityEntry): IdeaEntry {
  return {
    id: e.id,
    title: e.title,
    body: e.body,
    kind: 'note',
    status: e.status as IdeaStatus,
    subject: e.subject,
    order: e.order,
    created: e.created,
    log: logFromThread(e.thread),
    assets: e.assets,
  };
}

/** The detail view's `PlanEntry`, built from the entity the daemon already derived
 * a status for — it must not run `deriveStatus` again without the PR it lacks here. */
export function detailToPlan(e: EntityDetailEntry): PlanEntry {
  return {
    title: e.title,
    status: (e.status ?? 'idea') as PlanStatus,
    statusFallback: e.statusFallback,
    kind: e.type,
    entityKind: e.kind === 'note' ? undefined : e.kind,
    id: e.id,
    idea: e.idea,
    agent: e.agent,
    created: e.created,
    updated: e.updated,
    audited: e.audited,
    auditedHash: e.auditedHash,
    released: e.released,
    tags: e.tags,
    needs: e.needs,
    resolvedNeeds: e.resolvedNeeds,
    subject: e.subject,
    order: e.order,
    issueSource: e.issueSource,
    body: e.body,
    phases: e.phases,
    fixes: e.fixes,
    log: logFromThread(e.thread),
    clarifications: clarificationsFromThread(e.thread),
    notes: notesFromThread(e.thread),
    review: reviewFromThread(e.thread),
    thread: e.thread,
    archived: e.archived,
    pr: e.pr,
    assets: e.assets,
  };
}
