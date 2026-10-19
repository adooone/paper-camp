import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  EntityEntry,
  EntityKind,
  EntityStatus,
  IdeaEntry,
  ParseWarning,
  PhaseItem,
  PlanEntry,
  PrInfo,
  ThreadMessage,
} from '../types/index';
import { assertCorpusWritable } from './corpus-format';
import { entityToIdea, entityToPlan } from './entity-view';
import { resolveIdsWithMainActivity } from './git-log';
import { getPrMapFetchedAt, resolvePrsByEntity } from './git-pr/pr-lookup';
import { type EntriesByRoot, attachResolvedNeeds } from './needs';
import { parseEntityFile } from './parse/parser';
import { readEntities } from './readers';
import {
  archiveEntityFile,
  assignEntityId,
  formatEntityFile,
  todayDateString,
  unarchiveEntityFile,
} from './serialize';
import { deriveBoardStatus, deriveStatus, isClosedEntity } from './status';

export interface CorpusSnapshot {
  entries: EntityEntry[];
  work: PlanEntry[];
  notes: IdeaEntry[];
  warnings: ParseWarning[];
  prs: Map<string, PrInfo> | undefined;
  resolved: boolean;
  mainActivityIds: Set<string>;
  fingerprint: string;
}

async function fileStamp(path: string): Promise<string> {
  try {
    const s = await stat(path);
    return `${path}:${s.mtimeMs}:${s.size}`;
  } catch {
    return `${path}:-`;
  }
}

// Hand edits, terminal agents and git never call invalidateCorpus, so a cached read is
// trusted only while the ideas files it came from are the same set at the same mtimes.
export async function corpusFingerprint(ideasDir: string): Promise<string> {
  const stamps: string[] = [];
  for (const dir of [ideasDir, join(ideasDir, 'archive')]) {
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      stamps.push(`${dir}:-`);
      continue;
    }
    const mdFiles = files.filter((f) => f.endsWith('.md')).sort();
    stamps.push(...(await Promise.all(mdFiles.map((f) => fileStamp(join(dir, f))))));
  }
  stamps.push(await fileStamp(join(ideasDir, '..', 'run-order.md')));
  return stamps.join('\n');
}

async function buildSnapshot(
  root: string,
  ideasDir: string,
  fingerprint: string,
  prs: Map<string, PrInfo> | undefined,
  resolved: boolean,
  mainActivityIds: Set<string>,
): Promise<CorpusSnapshot> {
  const { entries: rawEntries, warnings } = await readEntities(ideasDir);
  const derived = rawEntries.map((e) => ({
    ...e,
    status: deriveStatus(e, prs?.get(e.id), resolved, mainActivityIds.has(e.id)),
  }));
  const entries = derived.map((e) => {
    if (e.kind !== 'board' || e.archived || e.status === 'done' || e.status === 'dropped') return e;
    const ticketStatuses = derived
      .filter((t) => t.kind === 'ticket' && t.idea === e.id)
      .map((t) => t.status ?? 'idea');
    return { ...e, status: deriveBoardStatus(ticketStatuses) };
  });

  const workRaw = entries
    .filter((e) => e.kind !== 'note')
    .map((e) => entityToPlan(e, prs?.get(e.id), resolved, mainActivityIds.has(e.id)));
  const workWithBoard = workRaw.map((p) => {
    if (p.entityKind !== 'board' || p.archived || p.status === 'done' || p.status === 'dropped') {
      return p;
    }
    const ticketStatuses = workRaw
      .filter((t) => t.entityKind === 'ticket' && t.idea === p.id)
      .map((t) => t.status);
    return { ...p, status: deriveBoardStatus(ticketStatuses) };
  });

  // Seeding the local root up front means attachResolvedNeeds never calls readCorpus
  // back for a same-project `needs:` ref while this call's own promise is pending below.
  const entriesByRoot: EntriesByRoot = new Map([[root, new Map(entries.map((e) => [e.id, e]))]]);
  const work = await attachResolvedNeeds(root, workWithBoard, readCorpus, entriesByRoot);

  const notes = entries.filter((e) => e.kind === 'note').map(entityToIdea);

  return { entries, work, notes, warnings, prs, resolved, mainActivityIds, fingerprint };
}

interface SnapshotCacheEntry {
  key: string;
  promise: Promise<CorpusSnapshot>;
}

const snapshotCache = new Map<string, SnapshotCacheEntry>();

// Keyed by root — clearing only this root's entry lets a project reflow
// without evicting every other open project's cache.
export function invalidateCorpus(root: string): void {
  snapshotCache.delete(root);
}

/** One snapshot of the whole corpus — entries, their plan/idea views, resolved PRs,
 * main-branch activity and the fingerprint they were all read at — cached per root
 * until a file under papercamp/ changes or the PR map refreshes. `live: true` lets
 * the PR lookup shell out to `gh` on its usual TTL; `false` (the default) serves
 * whatever's cached/persisted, for file-watcher-driven reads that aren't a human ask. */
export async function readCorpus(
  root: string,
  opts: { live?: boolean } = {},
): Promise<CorpusSnapshot> {
  const { live = false } = opts;
  const ideasDir = join(root, 'papercamp', 'ideas');
  const ttlMs = live ? undefined : Number.POSITIVE_INFINITY;

  const [fingerprint, prs, mainActivityIds] = await Promise.all([
    corpusFingerprint(ideasDir),
    resolvePrsByEntity(root, ttlMs),
    resolveIdsWithMainActivity(root),
  ]);
  const resolved = prs !== undefined;
  const fetchedAt = (await getPrMapFetchedAt(root)) ?? 0;
  const key = `${fingerprint}:${fetchedAt}`;

  const hit = snapshotCache.get(root);
  if (hit && hit.key === key) return hit.promise;

  const promise = buildSnapshot(root, ideasDir, fingerprint, prs, resolved, mainActivityIds).catch(
    (err) => {
      if (snapshotCache.get(root)?.key === key) snapshotCache.delete(root);
      throw err;
    },
  );
  snapshotCache.set(root, { key, promise });
  return promise;
}

export async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export const campFile = (root: string, name: string) => join(root, 'papercamp', name);

export type EntityFileInput = Parameters<typeof formatEntityFile>[0];

// Carries every field of the parsed entry so a partial update can't silently
// drop the type, agent override, or tags; `overrides` applies on top.
export function entityFileInput(
  entry: EntityEntry,
  overrides: Partial<EntityFileInput> = {},
): EntityFileInput {
  return {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    kind: entry.kind,
    status: entry.status,
    idea: entry.idea,
    agent: entry.agent,
    created: entry.created,
    updated: entry.updated,
    audited: entry.audited,
    auditedHash: entry.auditedHash,
    released: entry.released,
    tags: entry.tags,
    needs: entry.needs,
    subject: entry.subject,
    order: entry.storedOrder ?? entry.order,
    issueSource: entry.issueSource,
    body: entry.body,
    phases: entry.phases,
    fixes: entry.fixes,
    thread: entry.thread,
    unknownFrontmatter: entry.unknownFrontmatter,
    ...overrides,
  };
}

export async function writeEntityFile(
  root: string,
  path: string,
  input: EntityFileInput,
): Promise<void> {
  await assertCorpusWritable(campFile(root, 'config.json'));
  await writeFile(path, `${formatEntityFile(input)}\n`, 'utf-8');
}

/** Thrown by the write primitives below; routes map `status` straight onto the
 * HTTP response, MCP tools and hooks just read `.message`. */
export class CorpusError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'CorpusError';
    this.status = status;
  }
}

/** Resolves an id to its file, trying the primary ideas dir then `archive/` —
 * every write primitive below goes through this instead of assuming primary. */
export async function resolveEntityFilePath(root: string, id: string): Promise<string | null> {
  const ideasDir = campFile(root, 'ideas');
  const primary = join(ideasDir, `${id}.md`);
  if (await fileExists(primary)) return primary;
  const archived = join(ideasDir, 'archive', `${id}.md`);
  if (await fileExists(archived)) return archived;
  return null;
}

async function readEntityAt(filePath: string, archived: boolean): Promise<EntityEntry> {
  const raw = await readMaybe(filePath);
  if (!raw) throw new CorpusError(`entity file not found: ${filePath}`, 404);
  const entry = parseEntityFile(raw).entries[0];
  if (!entry) throw new CorpusError(`failed to parse entity file: ${filePath}`, 404);
  return { ...entry, archived, storedOrder: entry.order };
}

/** Reads entity `id` (primary or archived), lets `mutate` compute the field
 * overrides to apply, then writes it back — or, if `mutate` returns `undefined`,
 * leaves the file untouched (e.g. a phase index that no longer exists). A
 * done/archived entity (IDEA-187) refuses an override that adds phases/fixes, edits
 * the body, or reopens its status to anything but `done`/`dropped` — those spawn
 * their own linked fix entity instead; status, thread, agent, subject and order edits
 * still go through. `mutate`'s return is merged on top of every field carried over
 * from the parsed entry (see `entityFileInput`), so a key is only ever changed when
 * the override names it — an explicit `undefined` clears it, same as an omitted key
 * leaves it untouched, except for `status`, where the two differ: present-but-
 * `undefined` clears the stored override (and unarchives), omitted leaves it as-is. */
export async function updateEntity(
  root: string,
  id: string,
  mutate: (entry: EntityEntry) => Partial<EntityFileInput> | undefined,
): Promise<EntityEntry> {
  const filePath = await resolveEntityFilePath(root, id);
  if (!filePath) throw new CorpusError(`entity "${id}" not found`, 404);
  const ideasDir = campFile(root, 'ideas');
  const archived = filePath.startsWith(join(ideasDir, 'archive'));
  const entry = await readEntityAt(filePath, archived);

  const overrides = mutate(entry);
  if (overrides === undefined) return entry;

  if (isClosedEntity(entry)) {
    const addsPhases = (overrides.phases?.length ?? 0) > entry.phases.length;
    const addsFixes = (overrides.fixes?.length ?? 0) > (entry.fixes?.length ?? 0);
    const reopensStatus =
      Object.hasOwn(overrides, 'status') &&
      overrides.status !== undefined &&
      overrides.status !== 'done' &&
      overrides.status !== 'dropped';
    const editsBody = Object.hasOwn(overrides, 'body');
    if (addsPhases || addsFixes || reopensStatus || editsBody) {
      throw new CorpusError(
        'a done/archived entity is read-only — new work spawns its own fix entity',
      );
    }
  }

  const updated = overrides.updated ?? todayDateString();
  const input = entityFileInput(entry, { ...overrides, updated });
  await writeEntityFile(root, filePath, input);

  const closesNote = entry.kind === 'note' && overrides.status === 'done';
  if ((overrides.status === 'dropped' || closesNote) && !entry.archived) {
    await archiveEntityFile(root, id);
  } else if (
    Object.hasOwn(overrides, 'status') &&
    overrides.status === undefined &&
    entry.archived
  ) {
    await unarchiveEntityFile(root, id);
  }

  invalidateCorpus(root);
  return { ...entry, ...input } as EntityEntry;
}

/** Appends one thread message to entity `id` — the same closed-entity guard as
 * `updateEntity` applies, but a thread append never trips it (phases/fixes/body/status
 * are untouched), so it always goes through on an open or closed entity alike. */
export async function appendThread(
  root: string,
  id: string,
  message: ThreadMessage,
): Promise<EntityEntry> {
  return updateEntity(root, id, (entry) => ({
    thread: [...(entry.thread ?? []), message],
  }));
}

export interface CreateIdeaInput {
  title: string;
  content?: string;
  kind?: EntityKind;
  type?: string;
  status?: EntityStatus;
  subject?: string;
  needs?: string[];
  idea?: string;
  issueSource?: string;
  phases?: PhaseItem[];
}

/** Mints a new entity with the next lifetime id — a plain idea by default
 * (`status: idea`), or a linked fix/note/board/ticket when `kind` says so, in which
 * case the caller decides the initial status (usually left unset for a fix, so
 * derived status takes over once it has phases). */
export async function createIdea(root: string, input: CreateIdeaInput): Promise<string> {
  const configPath = campFile(root, 'config.json');
  await assertCorpusWritable(configPath);
  const id = await assignEntityId(configPath);
  if (!id) throw new CorpusError('could not assign entity ID', 500);
  const ideasDir = campFile(root, 'ideas');
  await mkdir(ideasDir, { recursive: true });
  const content = formatEntityFile({
    id,
    title: input.title.trim(),
    kind: input.kind,
    type: input.type,
    status: input.status ?? (input.kind === undefined ? 'idea' : undefined),
    idea: input.idea,
    issueSource: input.issueSource,
    created: todayDateString(),
    subject: input.subject,
    needs: input.needs,
    body: input.content?.trim(),
    phases: input.phases,
  });
  await writeFile(join(ideasDir, `${id}.md`), `${content}\n`, 'utf-8');
  invalidateCorpus(root);
  return id;
}
