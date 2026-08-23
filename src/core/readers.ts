import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ArchivableIdea,
  EntityEntry,
  IdeaEntry,
  ParseResult,
  ParseWarning,
  PlanEntry,
} from '../types/index';
import { entityToIdea, entityToPlan } from './entity-view';
import { resolveIdsWithMainActivity } from './git-log';
import { resolvePrsByEntity } from './git-pr/pr-lookup';
import { parseEntityFile } from './parse/parser';
import { parseRunOrderFile } from './run-order-file';
import { deriveBoardStatus, deriveStatus, isArchivable } from './status';

export { entityToIdea, entityToPlan } from './entity-view';

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
          ...result.entries.map((e) => ({
            ...e,
            archived,
            storedOrder: e.order,
            order: ranks.get(e.id) ?? e.order,
          })),
        );
      }
      warnings.push(...result.warnings);
    }
  }

  return { entries, warnings, fileCount };
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

/** One `gh` PR listing resolves every entity's PR (cached); the result is a shallow copy
 * that never touches disk, so it's safe to feed back into entityToPlan/deriveStatus elsewhere. */
export async function readEntitiesWithDerivedStatus(
  ideasDir: string,
): Promise<ParseResult<EntityEntry>> {
  const { entries, warnings, prs, resolved, mainActivityIds } = await readEntitiesAndPrs(ideasDir);
  const derived = entries.map((e) => ({
    ...e,
    status: deriveStatus(e, prs?.get(e.id), resolved, mainActivityIds.has(e.id)),
  }));
  const withBoardStatus = derived.map((e) => {
    if (e.kind !== 'board' || e.archived || e.status === 'done' || e.status === 'dropped') return e;
    const ticketStatuses = derived
      .filter((t) => t.kind === 'ticket' && t.idea === e.id)
      .map((t) => t.status ?? 'idea');
    return { ...e, status: deriveBoardStatus(ticketStatuses) };
  });
  return { entries: withBoardStatus, warnings };
}

export async function readWorkEntries(
  ideasDir: string,
  ttlMs?: number,
): Promise<ParseResult<PlanEntry> & { resolved: boolean }> {
  const { entries, warnings, prs, resolved, mainActivityIds } = await readEntitiesAndPrs(
    ideasDir,
    ttlMs,
  );
  const work = entries
    .filter((e) => e.kind !== 'note')
    .map((e) => entityToPlan(e, prs?.get(e.id), resolved, mainActivityIds.has(e.id)));
  const withBoardStatus = work.map((p) => {
    if (p.entityKind !== 'board' || p.archived || p.status === 'done' || p.status === 'dropped') {
      return p;
    }
    const ticketStatuses = work
      .filter((t) => t.entityKind === 'ticket' && t.idea === p.id)
      .map((t) => t.status);
    return { ...p, status: deriveBoardStatus(ticketStatuses) };
  });
  return { entries: withBoardStatus, warnings, resolved };
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
