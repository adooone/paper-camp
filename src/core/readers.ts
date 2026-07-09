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
  PrInfo,
} from '../types/index';
import { branchName } from './branch';
import { parseEntityFile } from './parser';
import { resolvePrInfo, resolvePrMerged } from './pr';
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
 * Local branches matching the `feat/idea-N-…` naming convention, mapped from the
 * entity id they encode (e.g. `IDEA-43`) to the branch's *actual* name.
 * `undefined` when git itself isn't available (no repo, no git binary) — callers
 * treat that as "can't derive branch-backed status, fall back to stored" rather
 * than "no branches exist". The real name matters: only the `feat/idea-N-` id
 * prefix is stable, while the title slug in the branch can drift from the
 * entity's current title (e.g. after a rename), so a PR lookup must query the
 * actual branch, not one recomputed from the title.
 */
function listBranchesByEntityId(ideasDir: string): Map<string, string> | undefined {
  // ideasDir is always <root>/papercamp/ideas.
  const root = join(ideasDir, '..', '..');
  const result = spawnSync('git', ['branch', '--format=%(refname:short)'], {
    cwd: root,
    encoding: 'utf-8',
  });
  if (result.error || result.status !== 0) return undefined;
  const byId = new Map<string, string>();
  for (const line of result.stdout.split('\n')) {
    const name = line.trim();
    const match = name.match(/^[a-z]+\/([a-z]+-\d+)-/);
    // First branch wins per id, for a deterministic pick if several share a prefix.
    if (match && !byId.has(match[1].toUpperCase())) byId.set(match[1].toUpperCase(), name);
  }
  return byId;
}

/**
 * Reads every entity from the unified directory, including its `archive/`
 * subdirectory (done/dropped entities live there). Excludes index.md.
 *
 * Also resolves which entities have a feature branch, for callers deriving
 * status (see `deriveStatus` / `entityToPlan`) — resolved once per read
 * rather than once per entity.
 */
export async function readEntities(ideasDir: string): Promise<
  ParseResult<EntityEntry> & {
    fileCount: number;
    branchEntityIds: Map<string, string> | undefined;
  }
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

  return { entries, warnings, fileCount, branchEntityIds: listBranchesByEntityId(ideasDir) };
}

/**
 * PlanEntry view of a work entity (anything that isn't a note): `kind` is the
 * entity's `type`. Lets the plan-shaped pipeline (API responses, prompts, UI)
 * keep working until the UI morphs to entities directly.
 *
 * `status` is derived from phases/branch/PR state rather than read straight
 * off `e.status` — see `deriveStatus`. `hasBranch` is `undefined` when the
 * caller has no branch information (e.g. git is unavailable), which falls
 * back to the stored override; `prMerged` is `undefined` when the caller has
 * no live PR-merged lookup (e.g. `gh` unavailable), same fallback. Note this
 * only affects the *view*: `e.status` itself stays the raw stored override,
 * so round-tripping an `EntityEntry` back to disk (e.g. after an edit) never
 * persists a derived value.
 */
export function entityToPlan(
  e: EntityEntry,
  hasBranch?: boolean,
  prMerged?: boolean,
  pr?: PrInfo,
): PlanEntry {
  return {
    title: e.title,
    // Non-note entities can't carry the note-only 'open' (schema-enforced).
    status: deriveStatus(e, hasBranch, prMerged) as PlanStatus,
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
    pr,
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

/**
 * Live-resolves whether `e`'s PR is merged, for entities where one could
 * plausibly exist: it must have grown phases, and either still have a local
 * branch or already carry a stored `done` (a squash-merge deletes the
 * branch, so a previously-done entity needs the live check to still find its
 * PR). Everything else skips the `gh` round-trip entirely — an idea or a
 * freshly-planned entity was never branched, so it can't have a PR.
 */
export async function resolvePrMergedForEntity(
  root: string,
  e: EntityEntry,
  hasBranch: boolean | undefined,
  liveBranch?: string,
): Promise<boolean | undefined> {
  if (e.phases.length === 0 || (!hasBranch && e.status !== 'done')) {
    return undefined;
  }
  // Prefer the actual branch name (its title slug may have drifted from the
  // entity's current title); fall back to the computed name when the branch is
  // gone (squash-merge deletes it, so a stored `done` needs the live PR check).
  const branch = liveBranch ?? branchName(e.id, e.type, e.title);
  if (!branch) return undefined;
  const merged = await resolvePrMerged(root, branch);
  // No live branch, and `gh` found no PR under the *computed* name: for an entity
  // that predates the current branch-naming convention (e.g. renumbered during the
  // IDEA-43 id-unification migration), the real historical branch/PR used a
  // different name, so this "no match" isn't proof of non-merge — don't let it
  // override a stored `done`. Only a currently-existing branch confirms the miss.
  if (!hasBranch && merged === false) return undefined;
  return merged;
}

/**
 * Live-resolves `e`'s full PR (number, url, draft/open/closed/merged state)
 * for the UI's PR badge — same "could plausibly have a PR" gate as
 * `resolvePrMergedForEntity`, and same branch-name derivation, so it targets
 * the identical `gh` lookup and hits that call's cache entry rather than
 * spawning a second `gh` process per entity per read.
 */
export function resolvePrInfoForEntity(
  root: string,
  e: EntityEntry,
  hasBranch: boolean | undefined,
  liveBranch?: string,
): Promise<PrInfo | undefined> {
  if (e.phases.length === 0 || (!hasBranch && e.status !== 'done')) {
    return Promise.resolve(undefined);
  }
  // Same real-branch-preferred resolution as resolvePrMergedForEntity, so both
  // target the identical `gh` lookup and share its cache entry.
  const branch = liveBranch ?? branchName(e.id, e.type, e.title);
  return branch ? resolvePrInfo(root, branch) : Promise.resolve(undefined);
}

/**
 * Every entity (including notes) with `status` replaced by its derived value —
 * for callers that need the resolved lifecycle without the PlanEntry reshape,
 * namely index generation and the branch-guard (see IDEA-56 phase 4). This is
 * a shallow copy: it never touches disk, so it's safe to feed straight back
 * into `entityToPlan`/`deriveStatus` elsewhere (a derived status round-trips
 * through the ladder's "no new signal, trust what's there" fallback) without
 * risking a stale-status write.
 */
export async function readEntitiesWithDerivedStatus(
  ideasDir: string,
): Promise<ParseResult<EntityEntry>> {
  const { entries, warnings, branchEntityIds } = await readEntities(ideasDir);
  const root = join(ideasDir, '..', '..');
  const derived = await Promise.all(
    entries.map(async (e) => {
      const hasBranch = branchEntityIds?.has(e.id);
      const prMerged = await resolvePrMergedForEntity(
        root,
        e,
        hasBranch,
        branchEntityIds?.get(e.id),
      );
      return { ...e, status: deriveStatus(e, hasBranch, prMerged) };
    }),
  );
  return { entries: derived, warnings };
}

/** All work entities (non-notes) in PlanEntry shape — the `/api/plans` view. */
export async function readWorkEntries(ideasDir: string): Promise<ParseResult<PlanEntry>> {
  const { entries, warnings, branchEntityIds } = await readEntities(ideasDir);
  const root = join(ideasDir, '..', '..');
  const work = entries.filter((e) => e.kind !== 'note');
  // Resolve merged-state before full PR info per entity — same `gh` lookup,
  // so the second call is a cache hit rather than a second `gh` process.
  const pr = await Promise.all(
    work.map(async (e) => {
      const hasBranch = branchEntityIds?.has(e.id);
      const liveBranch = branchEntityIds?.get(e.id);
      const prMerged = await resolvePrMergedForEntity(root, e, hasBranch, liveBranch);
      const prInfo = await resolvePrInfoForEntity(root, e, hasBranch, liveBranch);
      return { prMerged, prInfo };
    }),
  );
  return {
    entries: work.map((e, i) =>
      entityToPlan(e, branchEntityIds?.has(e.id), pr[i].prMerged, pr[i].prInfo),
    ),
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
