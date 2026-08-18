import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ArchivableIdea,
  EntityEntry,
  IdeaEntry,
  IdeaStatus,
  ParseResult,
  ParseWarning,
  PlanEntry,
  PlanStatus,
  PrInfo,
} from '../types/index';
import { resolveIdsWithMainActivity } from './git-log';
import { resolvePrsByEntity } from './git-pr/pr-lookup';
import { parseEntityFile } from './parse/parser';
import { parseRunOrderFile } from './run-order-file';
import { deriveStatus, isArchivable } from './status';
import {
  clarificationsFromThread,
  logFromThread,
  notesFromThread,
  reviewFromThread,
} from './thread';

async function readdirMaybe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function readFileMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

// papercamp/run-order.md sits alongside ideasDir's parent; rank is the 1-based
// list position, not the (possibly stale, pre-migration) frontmatter `order`.
async function readRunOrderRanks(ideasDir: string): Promise<Map<string, number>> {
  const content = await readFileMaybe(join(ideasDir, '..', 'run-order.md'));
  return new Map(parseRunOrderFile(content).map((e, i) => [e.id, i + 1]));
}

export async function readEntities(
  ideasDir: string,
): Promise<ParseResult<EntityEntry> & { fileCount: number }> {
  const entries: EntityEntry[] = [];
  const warnings: ParseWarning[] = [];
  let fileCount = 0;
  const ranks = await readRunOrderRanks(ideasDir);

  for (const dir of [ideasDir, join(ideasDir, 'archive')]) {
    const archived = dir !== ideasDir;
    const files = (await readdirMaybe(dir)).filter((f) => f.endsWith('.md') && f !== 'index.md');
    fileCount += files.length;
    const parsed = await Promise.all(
      files.map(async (file) => {
        const content = await readFileMaybe(join(dir, file));
        if (!content) {
          return { warnings: [{ title: file, message: 'Could not read entity file' }] };
        }
        return parseEntityFile(content);
      }),
    );
    for (const result of parsed) {
      if ('entries' in result) {
        entries.push(
          ...result.entries.map((e) => ({ ...e, archived, order: ranks.get(e.id) ?? e.order })),
        );
      }
      warnings.push(...result.warnings);
    }
  }

  return { entries, warnings, fileCount };
}

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
    kind: e.type,
    id: e.id,
    agent: e.agent,
    created: e.created,
    updated: e.updated,
    audited: e.audited,
    auditedHash: e.auditedHash,
    released: e.released,
    tags: e.tags,
    subject: e.subject,
    order: e.order,
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

async function readEntitiesAndPrs(ideasDir: string, ttlMs?: number) {
  const { entries, warnings } = await readEntities(ideasDir);
  const root = join(ideasDir, '..', '..');
  const [prs, mainActivityIds] = await Promise.all([
    resolvePrsByEntity(root, ttlMs),
    resolveIdsWithMainActivity(root),
  ]);
  return { entries, warnings, prs, resolved: prs !== undefined, mainActivityIds };
}

// One `gh` PR listing resolves every entity's PR (cached); this is a shallow copy
// that never touches disk, so it's safe to feed back into entityToPlan/deriveStatus
// elsewhere without risking a stale-status write.
export async function readEntitiesWithDerivedStatus(
  ideasDir: string,
): Promise<ParseResult<EntityEntry>> {
  const { entries, warnings, prs, resolved, mainActivityIds } = await readEntitiesAndPrs(ideasDir);
  const derived = entries.map((e) => ({
    ...e,
    status: deriveStatus(e, prs?.get(e.id), resolved, mainActivityIds.has(e.id)),
  }));
  return { entries: derived, warnings };
}

export async function readWorkEntries(
  ideasDir: string,
  ttlMs?: number,
): Promise<ParseResult<PlanEntry> & { resolved: boolean }> {
  const { entries, warnings, prs, resolved, mainActivityIds } = await readEntitiesAndPrs(
    ideasDir,
    ttlMs,
  );
  return {
    entries: entries
      .filter((e) => e.kind !== 'note')
      .map((e) => entityToPlan(e, prs?.get(e.id), resolved, mainActivityIds.has(e.id))),
    warnings,
    resolved,
  };
}

// Merged PR + review/done status + file still in ideasDir (not ideas/archive/): the
// human promotion (archive + status: done) is overdue but nothing writes it automatically.
export async function findArchivableIdeas(
  ideasDir: string,
): Promise<{ entries: ArchivableIdea[]; resolved: boolean }> {
  const { entries, prs, resolved } = await readEntitiesAndPrs(ideasDir);
  return {
    entries: entries.flatMap((e) => {
      const pr = prs?.get(e.id);
      return pr && isArchivable(e, pr) ? [{ id: e.id, title: e.title, pr }] : [];
    }),
    resolved,
  };
}

export async function readNoteEntries(ideasDir: string): Promise<ParseResult<IdeaEntry>> {
  const { entries, warnings } = await readEntities(ideasDir);
  return {
    entries: entries.filter((e) => e.kind === 'note').map(entityToIdea),
    warnings,
  };
}
