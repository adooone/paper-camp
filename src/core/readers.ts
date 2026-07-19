import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  EntityEntry,
  IdeaEntry,
  IdeaStatus,
  ParseResult,
  ParseWarning,
  PlanEntry,
  PlanStatus,
  PrInfo,
} from '../types/index';
import { resolvePrsByEntity } from './git-pr/pr-lookup';
import { parseEntityFile } from './parse/parser';
import { deriveStatus, isArchivable } from './status';

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

export async function readEntities(
  ideasDir: string,
): Promise<ParseResult<EntityEntry> & { fileCount: number }> {
  const entries: EntityEntry[] = [];
  const warnings: ParseWarning[] = [];
  let fileCount = 0;

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
        entries.push(...result.entries.map((e) => ({ ...e, archived })));
      }
      warnings.push(...result.warnings);
    }
  }

  return { entries, warnings, fileCount };
}

// status is derived via deriveStatus, not read from e.status: e.status stays the
// raw stored override so round-tripping an EntityEntry back to disk never persists
// a derived value.
export function entityToPlan(e: EntityEntry, pr?: PrInfo, prLookupResolved = false): PlanEntry {
  return {
    title: e.title,
    // Non-note entities can't carry the note-only 'open' (schema-enforced).
    status: deriveStatus(e, pr, prLookupResolved) as PlanStatus,
    kind: e.type,
    id: e.id,
    agent: e.agent,
    created: e.created,
    updated: e.updated,
    audited: e.audited,
    auditedHash: e.auditedHash,
    tags: e.tags,
    subject: e.subject,
    order: e.order,
    body: e.body,
    phases: e.phases,
    log: e.log,
    clarifications: e.clarifications,
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
    log: e.log,
  };
}

async function readEntitiesAndPrs(ideasDir: string) {
  const { entries, warnings } = await readEntities(ideasDir);
  const prs = await resolvePrsByEntity(join(ideasDir, '..', '..'));
  return { entries, warnings, prs, resolved: prs !== undefined };
}

// One `gh` PR listing resolves every entity's PR (cached); this is a shallow copy
// that never touches disk, so it's safe to feed back into entityToPlan/deriveStatus
// elsewhere without risking a stale-status write.
export async function readEntitiesWithDerivedStatus(
  ideasDir: string,
): Promise<ParseResult<EntityEntry>> {
  const { entries, warnings, prs, resolved } = await readEntitiesAndPrs(ideasDir);
  const derived = entries.map((e) => ({
    ...e,
    status: deriveStatus(e, prs?.get(e.id), resolved),
  }));
  return { entries: derived, warnings };
}

export async function readWorkEntries(ideasDir: string): Promise<ParseResult<PlanEntry>> {
  const { entries, warnings, prs, resolved } = await readEntitiesAndPrs(ideasDir);
  return {
    entries: entries
      .filter((e) => e.kind !== 'note')
      .map((e) => entityToPlan(e, prs?.get(e.id), resolved)),
    warnings,
  };
}

export interface ArchivableIdea {
  id: string;
  title: string;
  pr: PrInfo;
}

// Merged PR + review/done status + file still in ideasDir (not ideas/archive/): the
// human promotion (archive + status: done) is overdue but nothing writes it automatically.
export async function findArchivableIdeas(ideasDir: string): Promise<ArchivableIdea[]> {
  const { entries, prs } = await readEntitiesAndPrs(ideasDir);
  return entries.flatMap((e) => {
    const pr = prs?.get(e.id);
    return pr && isArchivable(e, pr) ? [{ id: e.id, title: e.title, pr }] : [];
  });
}

export async function readNoteEntries(ideasDir: string): Promise<ParseResult<IdeaEntry>> {
  const { entries, warnings } = await readEntities(ideasDir);
  return {
    entries: entries.filter((e) => e.kind === 'note').map(entityToIdea),
    warnings,
  };
}
