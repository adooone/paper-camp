import type {
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

// status is derived via deriveStatus, not read from e.status: e.status stays the
// raw stored override so round-tripping an EntityEntry back to disk never persists
// a derived value.
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
  };
}
