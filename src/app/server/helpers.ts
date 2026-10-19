import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appendChatMessage, formatChatFile, parseChatFile } from '@/core/chat-file';
import {
  CorpusError,
  type CreateIdeaInput,
  type EntityFileInput,
  appendThread,
  campFile,
  createIdea,
  entityFileInput,
  fileExists,
  readMaybe,
  resolveEntityFilePath,
  updateEntity,
  writeEntityFile,
} from '@/core/corpus';
import {
  type RunOrderFileEntry,
  formatRunOrderFile,
  parseRunOrderFile,
} from '@/core/run-order-file';
import type { BranchHygieneStatus, StaleBaseRef, ThreadMessage } from '@/types/index';

export {
  appendThread,
  campFile,
  type CreateIdeaInput,
  CorpusError,
  createIdea,
  type EntityFileInput,
  entityFileInput,
  fileExists,
  readMaybe,
  resolveEntityFilePath,
  updateEntity,
  writeEntityFile,
};

// Dotfile dir for machine-generated task output, distinct from the human/agent-authored corpus.
export const taskLogFile = (root: string, taskId: string) =>
  join(root, 'papercamp', '.task-logs', `${taskId}.log`);

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

// Every read-modify-write of chat.md must run as one critical section, or a question
// parked by a background run can land between a route's read and its write and be lost.
let chatLock: Promise<unknown> = Promise.resolve();

export function withChatLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = chatLock.then(fn, fn);
  chatLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// Persisted before the reply is generated so the user's message survives a slow or
// failed agent run, then again once the reply lands — mirrors the feedback-message route.
export async function appendToChatFile(root: string, message: ThreadMessage): Promise<void> {
  await withChatLock(async () => {
    const content = await readMaybe(chatFilePath(root));
    await writeFile(chatFilePath(root), appendChatMessage(content, message), 'utf-8');
  });
}

export async function clearChatFile(root: string): Promise<void> {
  await withChatLock(async () => {
    const kept = (await readChatFile(root)).filter(
      (m) => m.kind === 'question' && m.state === 'open',
    );
    await writeFile(chatFilePath(root), formatChatFile(kept), 'utf-8');
  });
}

// Mirrors a question's resolution (IDEA-251) into chat.md once it's answered on the
// entity's own thread, so the chat copy stops pinning an already-resolved question.
export async function resolveChatQuestion(root: string, entityId: string): Promise<void> {
  await withChatLock(async () => {
    const messages = await readChatFile(root);
    const index = messages.findLastIndex(
      (m) => m.kind === 'question' && m.state === 'open' && m.entityId === entityId,
    );
    if (index === -1) return;
    const resolved = messages.map((m, i) =>
      i === index ? { ...m, state: 'resolved' as const } : m,
    );
    await writeFile(chatFilePath(root), formatChatFile(resolved), 'utf-8');
  });
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
