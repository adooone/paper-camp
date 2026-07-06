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
} from '../types/index';
import { parseEntityFile } from './parser';

// ---------------------------------------------------------------------------
// Unified entity reader  (FEAT-42 phases 8–9: one corpus under papercamp/ideas/,
// one file per entity — an "idea" for its whole life, plan as a Phases section.)
//
// Everything here touches the filesystem; the pure string -> data parsing it
// builds on lives in parser.ts. The legacy two-file readers
// (readPlansMerged/readIdeasMerged and the per-dir scanners) retired with the
// migration; `paper-camp migrate` reads legacy shapes through the old parsers
// directly.
// ---------------------------------------------------------------------------

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

/**
 * Reads every entity from the unified directory, including its `archive/`
 * subdirectory (done/dropped entities live there). Excludes index.md.
 */
export async function readEntities(
  ideasDir: string,
): Promise<ParseResult<EntityEntry> & { fileCount: number }> {
  const entries: EntityEntry[] = [];
  const warnings: ParseWarning[] = [];
  let fileCount = 0;

  for (const dir of [ideasDir, join(ideasDir, 'archive')]) {
    const files = (await readdirMaybe(dir)).filter((f) => f.endsWith('.md') && f !== 'index.md');
    fileCount += files.length;
    for (const file of files) {
      const content = await readFileMaybe(join(dir, file));
      if (!content) {
        warnings.push({ title: file, message: 'Could not read entity file' });
        continue;
      }
      const result = parseEntityFile(content);
      entries.push(...result.entries);
      warnings.push(...result.warnings);
    }
  }

  return { entries, warnings, fileCount };
}

/**
 * PlanEntry view of a work entity (anything that isn't a note): `kind` is the
 * entity's `type`. Lets the plan-shaped pipeline (API responses, prompts, UI)
 * keep working until the UI morphs to entities directly.
 */
export function entityToPlan(e: EntityEntry): PlanEntry {
  return {
    title: e.title,
    // Non-note entities can't carry the note-only 'open' (schema-enforced).
    status: e.status as PlanStatus,
    kind: e.type,
    id: e.id,
    agent: e.agent,
    created: e.created,
    updated: e.updated,
    audited: e.audited,
    auditedHash: e.auditedHash,
    tags: e.tags,
    body: e.body,
    phases: e.phases,
    log: e.log,
    clarifications: e.clarifications,
  };
}

/** IdeaEntry view of a note entity, for the note-shaped API/UI surface. */
export function entityToIdea(e: EntityEntry): IdeaEntry {
  return {
    id: e.id,
    title: e.title,
    body: e.body,
    kind: 'note',
    status: e.status as IdeaStatus,
    log: e.log,
  };
}

/** All work entities (non-notes) in PlanEntry shape — the `/api/plans` view. */
export async function readWorkEntries(ideasDir: string): Promise<ParseResult<PlanEntry>> {
  const { entries, warnings } = await readEntities(ideasDir);
  return {
    entries: entries.filter((e) => e.kind !== 'note').map(entityToPlan),
    warnings,
  };
}

/** All note entities in IdeaEntry shape — the `/api/ideas` view. */
export async function readNoteEntries(ideasDir: string): Promise<ParseResult<IdeaEntry>> {
  const { entries, warnings } = await readEntities(ideasDir);
  return {
    entries: entries.filter((e) => e.kind === 'note').map(entityToIdea),
    warnings,
  };
}
