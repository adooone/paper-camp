import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { EntityEntry, IdeaEntry, ParseWarning, PlanEntry, PrInfo } from '../types/index';
import { entityToIdea, entityToPlan } from './entity-view';
import { resolveIdsWithMainActivity } from './git-log';
import { getPrMapFetchedAt, resolvePrsByEntity } from './git-pr/pr-lookup';
import { type EntriesByRoot, attachResolvedNeeds } from './needs';
import { readEntities } from './readers';
import { deriveBoardStatus, deriveStatus } from './status';

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

  // Seeding the local root up front means attachResolvedNeeds never calls back into
  // readCorpus for a same-project `needs:` ref — that would re-enter this very call
  // while its own promise is still pending in the cache below and deadlock.
  const entriesByRoot: EntriesByRoot = new Map([[root, new Map(entries.map((e) => [e.id, e]))]]);
  const work = await attachResolvedNeeds(root, workWithBoard, entriesByRoot);

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
