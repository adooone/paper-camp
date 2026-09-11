import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appendChatMessage, formatChatFile, parseChatFile } from '@/core/chat-file';
import { assertCorpusWritable } from '@/core/corpus-format';
import { readEntitiesWithDerivedStatus } from '@/core/readers';
import {
  type RunOrderFileEntry,
  formatRunOrderFile,
  parseRunOrderFile,
} from '@/core/run-order-file';
import { assignEntityId, formatEntityFile, todayDateString } from '@/core/serialize';
import type { BranchHygieneStatus, EntityEntry, StaleBaseRef, ThreadMessage } from '@/types/index';

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

// Dotfile dir for machine-generated task output, distinct from the human/agent-authored corpus.
export const taskLogFile = (root: string, taskId: string) =>
  join(root, 'papercamp', '.task-logs', `${taskId}.log`);

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

// Shared by the /api/ideas route and the MCP `add_idea`/`draft_plan` tools, and now
// the project chat's "describe new work" move (IDEA-251), so an idea file is only
// ever assembled in one place.
export async function createIdeaEntity(
  root: string,
  input: { title: string; content?: string; type?: string; subject?: string },
): Promise<string> {
  const configPath = campFile(root, 'config.json');
  const id = await assignEntityId(configPath);
  if (!id) throw new Error('could not assign entity ID');
  const ideasDir = campFile(root, 'ideas');
  await mkdir(ideasDir, { recursive: true });
  const content = formatEntityFile({
    id,
    title: input.title.trim(),
    type: input.type,
    status: 'idea',
    created: todayDateString(),
    subject: input.subject,
    body: input.content?.trim(),
  });
  await writeFile(join(ideasDir, `${id}.md`), `${content}\n`, 'utf-8');
  return id;
}

export const runOrderFilePath = (root: string) => campFile(root, 'run-order.md');

export async function readRunOrderFile(root: string): Promise<RunOrderFileEntry[]> {
  return parseRunOrderFile(await readMaybe(runOrderFilePath(root)));
}

export async function writeRunOrderFile(root: string, list: RunOrderFileEntry[]): Promise<void> {
  await writeFile(runOrderFilePath(root), formatRunOrderFile(list), 'utf-8');
}

export const chatFilePath = (root: string) => campFile(root, 'chat.md');

export async function readChatFile(root: string): Promise<ThreadMessage[]> {
  return parseChatFile(await readMaybe(chatFilePath(root)));
}

// Persisted before the reply is generated so the user's message survives a slow or
// failed agent run, then again once the reply lands — mirrors the feedback-message route.
export async function appendToChatFile(root: string, message: ThreadMessage): Promise<void> {
  const content = await readMaybe(chatFilePath(root));
  await writeFile(chatFilePath(root), appendChatMessage(content, message), 'utf-8');
}

export async function clearChatFile(root: string): Promise<void> {
  const kept = (await readChatFile(root)).filter(
    (m) => m.kind === 'question' && m.state === 'open',
  );
  await writeFile(chatFilePath(root), formatChatFile(kept), 'utf-8');
}

// Mirrors a question's resolution (IDEA-251) into chat.md once it's answered on the
// entity's own thread, so the chat copy stops pinning an already-resolved question.
export async function resolveChatQuestion(root: string, entityId: string): Promise<void> {
  const messages = await readChatFile(root);
  const index = messages.findLastIndex(
    (m) => m.kind === 'question' && m.state === 'open' && m.entityId === entityId,
  );
  if (index === -1) return;
  const resolved = messages.map((m, i) => (i === index ? { ...m, state: 'resolved' as const } : m));
  await writeFile(chatFilePath(root), formatChatFile(resolved), 'utf-8');
}

// Every read-normalize-write of run-order.md must run as one critical section, or an
// interleaved pass can normalize against a stale read and clobber a concurrent write.
let runOrderLock: Promise<unknown> = Promise.resolve();

export function withRunOrderLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = runOrderLock.then(fn, fn);
  runOrderLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Refuses (rather than warns) when the branch was forked before another ref finished
 * this plan's phases — otherwise that work would be silently redone. */
export async function checkStaleBaseForRunAll(
  git: { findStaleBaseRef: (id: string) => Promise<StaleBaseRef | null> },
  planId: string,
): Promise<string | null> {
  const stale = await git.findStaleBaseRef(planId);
  if (!stale) return null;
  return `${planId} already has ${stale.done}/${stale.total} phases complete on ${stale.ref}. This branch is forked from before that work — rebase or switch branches.`;
}
