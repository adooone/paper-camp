import { entityToIdea, entityToPlan } from '@/core/entity-view';
import { parseEntityFile } from '@/core/parse/parser';
import { classifyRunOrderEntries, normalizeRunOrder } from '@/core/run-order';
import { formatRunOrderFile, parseRunOrderFile } from '@/core/run-order-file';
import { formatEntityFile, todayDateString } from '@/core/serialize/entity-file';
import { isClosedEntity } from '@/core/status';
import { replaceThreadKinds } from '@/core/thread';
import type {
  AgentId,
  EntityEntry,
  IdeaEntry,
  LogEntry,
  ParseResult,
  PhaseItem,
  PlanEntry,
  PlanStatus,
  ThreadMessage,
} from '@/types/index';
import { type GithubFile, deleteFile, getFile, listDir, putFile } from './client';
import type { GithubCorpusConfig } from './config-store';

const IDEAS_DIR = 'papercamp/ideas';
const CONFIG_PATH = 'papercamp/config.json';
const RUN_ORDER_PATH = 'papercamp/run-order.md';

interface LoadedEntity {
  entry: EntityEntry;
  path: string;
  sha: string;
}

async function readDirEntities(
  config: GithubCorpusConfig,
  dir: string,
  archived: boolean,
): Promise<LoadedEntity[]> {
  const files = (await listDir(config, dir)).filter(
    (f) => f.type === 'file' && f.name.endsWith('.md') && f.name !== 'index.md',
  );
  const loaded = await Promise.all(
    files.map(async (file): Promise<LoadedEntity | null> => {
      const path = `${dir}/${file.name}`;
      const github = await getFile(config, path);
      if (!github) return null;
      const entry = parseEntityFile(github.content).entries[0];
      if (!entry) return null;
      return { entry: { ...entry, archived }, path, sha: github.sha };
    }),
  );
  return loaded.filter((e): e is LoadedEntity => e !== null);
}

async function readRunOrderRanks(config: GithubCorpusConfig): Promise<Map<string, number>> {
  const file = await getFile(config, RUN_ORDER_PATH);
  return new Map(parseRunOrderFile(file?.content ?? '').map((e, i) => [e.id, i + 1]));
}

// Mirrors core/readers.ts#readEntities against api.github.com instead of the
// filesystem — no PR lookup (no `gh` in the browser), so callers get the same
// offline fallback deriveStatus already gives a runtime with gh unreachable.
async function readEntitiesFromGithub(config: GithubCorpusConfig): Promise<LoadedEntity[]> {
  const [live, archived, ranks] = await Promise.all([
    readDirEntities(config, IDEAS_DIR, false),
    readDirEntities(config, `${IDEAS_DIR}/archive`, true),
    readRunOrderRanks(config),
  ]);
  return [...live, ...archived].map(
    (loaded): LoadedEntity => ({
      ...loaded,
      entry: {
        ...loaded.entry,
        storedOrder: loaded.entry.order,
        order: ranks.get(loaded.entry.id) ?? loaded.entry.order,
      },
    }),
  );
}

export async function fetchGithubIdeas(
  config: GithubCorpusConfig,
): Promise<ParseResult<IdeaEntry>> {
  const loaded = await readEntitiesFromGithub(config);
  return {
    entries: loaded.filter((l) => l.entry.kind === 'note').map((l) => entityToIdea(l.entry)),
    warnings: [],
  };
}

export async function fetchGithubPlans(
  config: GithubCorpusConfig,
): Promise<ParseResult<PlanEntry> & { resolved: boolean }> {
  const loaded = await readEntitiesFromGithub(config);
  return {
    entries: loaded
      .filter((l) => l.entry.kind !== 'note')
      .map((l) => entityToPlan(l.entry, undefined, false, false)),
    warnings: [],
    resolved: false,
  };
}

interface ConfigFile {
  nextId?: Partial<Record<string, number>> & { idea?: number };
  [key: string]: unknown;
}

async function readConfigFile(
  config: GithubCorpusConfig,
): Promise<{ file: ConfigFile; sha: string }> {
  const github = await getFile(config, CONFIG_PATH);
  if (!github) throw new Error('papercamp/config.json not found in this repo');
  return { file: JSON.parse(github.content) as ConfigFile, sha: github.sha };
}

// Chained so two nearly-simultaneous mints in this tab can't read the same counter —
// mirrors serializer.ts#idAssignmentChain; a concurrent second tab/device is an
// accepted gap, same as the runtime's own single-process guarantee.
let idAssignmentChain: Promise<unknown> = Promise.resolve();

export async function createGithubIdea(
  config: GithubCorpusConfig,
  idea: { title: string; content?: string; kind?: 'idea' | 'note' },
): Promise<string> {
  const run = idAssignmentChain.then(async () => {
    const { file, sha } = await readConfigFile(config);
    const nextId = file.nextId ?? {};
    const next = nextId.idea ?? 1;
    const id = `IDEA-${next}`;
    await putFile(
      config,
      CONFIG_PATH,
      JSON.stringify({ ...file, nextId: { ...nextId, idea: next + 1 } }, null, 2),
      `chore(papercamp): mint ${id}`,
      sha,
    );
    const isNote = idea.kind === 'note';
    const content = formatEntityFile({
      id,
      title: idea.title.trim(),
      kind: isNote ? 'note' : undefined,
      status: isNote ? 'open' : 'idea',
      created: todayDateString(),
      body: idea.content?.trim(),
    });
    await putFile(config, `${IDEAS_DIR}/${id}.md`, `${content}\n`, `feat(papercamp): draft ${id}`);
    return id;
  });
  idAssignmentChain = run.catch(() => undefined);
  return run;
}

export interface GithubPlanUpdates {
  body?: string;
  phases?: PhaseItem[];
  fixes?: PhaseItem[];
  status?: PlanStatus | null;
  log?: LogEntry[];
  thread?: ThreadMessage[];
  agent?: AgentId | null;
  subject?: string | null;
  order?: number | null;
}

function findEntity(loaded: LoadedEntity[], key: string, includeNotes: boolean) {
  return loaded.find(
    (l) =>
      (includeNotes || l.entry.kind !== 'note') && (l.entry.title === key || l.entry.id === key),
  );
}

async function commitEntity(
  config: GithubCorpusConfig,
  target: LoadedEntity,
  updated: EntityEntry,
  message: string,
): Promise<void> {
  const content = formatEntityFile({
    id: updated.id,
    title: updated.title,
    type: updated.type,
    kind: updated.kind,
    status: updated.status,
    idea: updated.idea,
    agent: updated.agent,
    created: updated.created,
    updated: updated.updated,
    audited: updated.audited,
    auditedHash: updated.auditedHash,
    released: updated.released,
    tags: updated.tags,
    subject: updated.subject,
    order: updated.storedOrder ?? updated.order,
    issueSource: updated.issueSource,
    body: updated.body,
    phases: updated.phases,
    fixes: updated.fixes,
    thread: updated.thread,
    unknownFrontmatter: updated.unknownFrontmatter,
  });
  await putFile(config, target.path, `${content}\n`, message, target.sha);
}

async function reflowRunOrder(
  config: GithubCorpusConfig,
  loaded: LoadedEntity[],
  targetId: string,
  moved?: { id: string; order: number },
): Promise<void> {
  const classified = classifyRunOrderEntries(
    loaded.map((l) => l.entry),
    loaded
      .filter((l) => l.entry.kind !== 'note')
      .map((l) => entityToPlan(l.entry, undefined, false, false)),
  );
  const runOrderFile: GithubFile | null = await getFile(config, RUN_ORDER_PATH);
  const list = parseRunOrderFile(runOrderFile?.content ?? '');
  const next = formatRunOrderFile(normalizeRunOrder(list, classified, moved));
  await putFile(
    config,
    RUN_ORDER_PATH,
    next,
    `chore(papercamp): reorder queue after ${targetId}`,
    runOrderFile?.sha,
  );
}

// Mirrors the PATCH /api/plans route against api.github.com — the write half of
// plan-only. Every field it accepts round-trips through the same formatEntityFile
// the runtime writes with, so a plan-only edit and a runtime edit produce the same
// corpus shape.
export async function saveGithubEntity(
  config: GithubCorpusConfig,
  key: string,
  updates: GithubPlanUpdates,
): Promise<void> {
  const loaded = await readEntitiesFromGithub(config);
  const target = findEntity(loaded, key, true);
  if (!target) throw new Error('entity not found');

  if (isClosedEntity(target.entry)) {
    const addsPhases = (updates.phases?.length ?? 0) > target.entry.phases.length;
    const addsFixes = (updates.fixes?.length ?? 0) > (target.entry.fixes?.length ?? 0);
    const reopensStatus =
      updates.status !== undefined &&
      updates.status !== null &&
      updates.status !== 'done' &&
      updates.status !== 'dropped';
    if (addsPhases || addsFixes || reopensStatus || updates.body !== undefined) {
      throw new Error('a done/archived entity is read-only — new work spawns its own fix entity');
    }
  }

  let thread = target.entry.thread;
  if (updates.thread !== undefined) thread = updates.thread;
  if (updates.log !== undefined) {
    thread = replaceThreadKinds(
      thread,
      ['log'],
      updates.log.map((e) => ({ kind: 'log' as const, date: e.date, text: e.text })),
    );
  }

  const updatedEntry: EntityEntry = {
    ...target.entry,
    ...(updates.body !== undefined && { body: updates.body }),
    ...(updates.status !== undefined && { status: updates.status ?? undefined }),
    ...(updates.phases !== undefined && { phases: updates.phases }),
    ...(updates.fixes !== undefined && { fixes: updates.fixes }),
    ...(thread !== target.entry.thread && { thread }),
    ...(updates.agent !== undefined && { agent: updates.agent ?? undefined }),
    ...(updates.subject !== undefined && { subject: updates.subject ?? undefined }),
    order:
      target.entry.kind === 'note'
        ? updates.order !== undefined
          ? (updates.order ?? undefined)
          : target.entry.order
        : undefined,
    updated: todayDateString(),
  };

  // Only one plan in-progress at a time — demote every other in-progress entity
  // before committing this one, same invariant the runtime's PATCH route keeps.
  if (updates.status === 'in-progress') {
    for (const other of loaded) {
      if (
        other.entry.id !== target.entry.id &&
        other.entry.kind !== 'note' &&
        other.entry.status === 'in-progress'
      ) {
        await commitEntity(
          config,
          other,
          { ...other.entry, status: 'planned', updated: todayDateString() },
          `chore(papercamp): demote ${other.entry.id}`,
        );
      }
    }
  }

  await commitEntity(config, target, updatedEntry, `chore(papercamp): update ${target.entry.id}`);

  if (
    target.entry.kind !== 'note' &&
    (updates.order !== undefined || updates.status !== undefined)
  ) {
    const moved =
      typeof updates.order === 'number' ? { id: target.entry.id, order: updates.order } : undefined;
    const nextLoaded = loaded.map((l) =>
      l.entry.id === target.entry.id ? { ...l, entry: updatedEntry } : l,
    );
    await reflowRunOrder(config, nextLoaded, target.entry.id, moved);
  }

  // `done` is derived from a merged PR (unavailable here) and needs no archiving;
  // `dropped` has no such signal, so it's still the one status that archives on write.
  if (updates.status === 'dropped') {
    const fresh = await getFile(config, target.path);
    if (fresh) {
      await putFile(
        config,
        `${IDEAS_DIR}/archive/${target.entry.id}.md`,
        fresh.content,
        `chore(papercamp): archive ${target.entry.id}`,
      );
      await deleteFile(
        config,
        target.path,
        fresh.sha,
        `chore(papercamp): archive ${target.entry.id}`,
      );
    }
  }
}
