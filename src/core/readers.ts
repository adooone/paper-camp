import { spawnSync } from 'node:child_process';
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
import { deriveStatus } from './status';

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
 * Local branches matching the `feat/idea-N-…` naming convention, keyed by the
 * entity id they encode (e.g. `IDEA-43`). `undefined` when git itself isn't
 * available (no repo, no git binary) — callers treat that as "can't derive
 * branch-backed status, fall back to stored" rather than "no branches exist".
 */
function listBranchEntityIds(ideasDir: string): Set<string> | undefined {
  // ideasDir is always <root>/papercamp/ideas.
  const root = join(ideasDir, '..', '..');
  const result = spawnSync('git', ['branch', '--format=%(refname:short)'], {
    cwd: root,
    encoding: 'utf-8',
  });
  if (result.error || result.status !== 0) return undefined;
  const ids = new Set<string>();
  for (const line of result.stdout.split('\n')) {
    const match = line.trim().match(/^[a-z]+\/([a-z]+-\d+)-/);
    if (match) ids.add(match[1].toUpperCase());
  }
  return ids;
}

/**
 * Reads every entity from the unified directory, including its `archive/`
 * subdirectory (done/dropped entities live there). Excludes index.md.
 *
 * Also resolves which entities have a feature branch, for callers deriving
 * status (see `deriveStatus` / `entityToPlan`) — resolved once per read
 * rather than once per entity.
 */
export async function readEntities(
  ideasDir: string,
): Promise<
  ParseResult<EntityEntry> & { fileCount: number; branchEntityIds: Set<string> | undefined }
> {
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

  return { entries, warnings, fileCount, branchEntityIds: listBranchEntityIds(ideasDir) };
}

/**
 * PlanEntry view of a work entity (anything that isn't a note): `kind` is the
 * entity's `type`. Lets the plan-shaped pipeline (API responses, prompts, UI)
 * keep working until the UI morphs to entities directly.
 *
 * `status` is derived from phases/branch existence rather than read straight
 * off `e.status` — see `deriveStatus`. `hasBranch` is `undefined` when the
 * caller has no branch information (e.g. git is unavailable), which falls
 * back to the stored override. Note this only affects the *view*: `e.status`
 * itself stays the raw stored override, so round-tripping an `EntityEntry`
 * back to disk (e.g. after an edit) never persists a derived value.
 */
export function entityToPlan(e: EntityEntry, hasBranch?: boolean): PlanEntry {
  return {
    title: e.title,
    // Non-note entities can't carry the note-only 'open' (schema-enforced).
    status: deriveStatus(e, hasBranch) as PlanStatus,
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
  const { entries, warnings, branchEntityIds } = await readEntities(ideasDir);
  return {
    entries: entries
      .filter((e) => e.kind !== 'note')
      .map((e) => entityToPlan(e, branchEntityIds?.has(e.id))),
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
