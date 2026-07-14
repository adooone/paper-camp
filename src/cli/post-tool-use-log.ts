import { relative } from 'node:path';
import { campFile, fileExists, readMaybe } from '../app/server/helpers';
import { prependProgressItem } from '../core/serialize';
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
 * and bash (none of which are Write calls) never match.
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
