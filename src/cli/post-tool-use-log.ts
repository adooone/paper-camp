#!/usr/bin/env node
import { relative } from 'node:path';
import { campFile, fileExists, readMaybe } from '../app/server/helpers';
import { prependProgressItem } from '../core/serializer';
import type { PaperCampConfig } from '../types/index';

interface PostToolUseInput {
  tool_name?: string;
  tool_input?: { file_path?: string };
  tool_response?: { structuredPatch?: unknown[] };
}

async function readConfig(root: string): Promise<PaperCampConfig | null> {
  const raw = await readMaybe(campFile(root, 'config.json'));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaperCampConfig;
  } catch {
    return null;
  }
}

/**
 * Opt-in PostToolUse hook body: logs brand-new files to progress.md.
 * Off unless papercamp/config.json sets `autoLogNewFiles: true`. Fires only for a Write
 * whose structuredPatch is empty — Claude Code leaves that empty when the Write tool
 * created the file rather than overwriting existing content — so edits, reads, searches,
 * bash, and commits (none of which are Write calls) never match, and this never
 * double-logs against the git post-commit hook.
 */
export async function logNewFile(root: string, input: PostToolUseInput): Promise<void> {
  const config = await readConfig(root);
  if (!config?.autoLogNewFiles) return;
  if (input.tool_name !== 'Write') return;
  const filePath = input.tool_input?.file_path;
  if (!filePath) return;
  if ((input.tool_response?.structuredPatch?.length ?? 0) > 0) return;
  if (!(await fileExists(campFile(root, '')))) return;

  const rel = relative(root, filePath);
  await prependProgressItem(campFile(root, 'progress.md'), `New file: ${rel}`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const raw = await readStdin().catch(() => '');
  const input = raw ? (JSON.parse(raw) as PostToolUseInput) : {};
  await logNewFile(root, input).catch(() => undefined);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
