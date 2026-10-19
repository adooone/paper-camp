import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EntityEntry, ParseResult, ParseWarning } from '../types/index';
import { parseEntityFile } from './parse/parser';
import { parseRunOrderFile } from './run-order-file';

export { entityToIdea, entityToPlan } from './entity-view';

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

// papercamp/run-order.md sits alongside ideasDir's parent; rank is the 1-based
// list position, not the (possibly stale, pre-migration) frontmatter `order`.
async function readRunOrderRanks(ideasDir: string): Promise<Map<string, number>> {
  const content = await readFileMaybe(join(ideasDir, '..', 'run-order.md'));
  return new Map(parseRunOrderFile(content).map((e, i) => [e.id, i + 1]));
}

export async function readEntities(
  ideasDir: string,
): Promise<ParseResult<EntityEntry> & { fileCount: number }> {
  const entries: EntityEntry[] = [];
  const warnings: ParseWarning[] = [];
  let fileCount = 0;
  const ranks = await readRunOrderRanks(ideasDir);

  for (const dir of [ideasDir, join(ideasDir, 'archive')]) {
    const archived = dir !== ideasDir;
    const files = (await readdirMaybe(dir)).filter((f) => f.endsWith('.md') && f !== 'index.md');
    fileCount += files.length;
    const parsed = await Promise.all(
      files.map(async (file) => {
        const content = await readFileMaybe(join(dir, file));
        if (!content) {
          return { warnings: [{ title: file, message: 'Could not read entity file' }] };
        }
        return parseEntityFile(content);
      }),
    );
    for (const result of parsed) {
      if ('entries' in result) {
        entries.push(
          ...result.entries.map((e) => ({
            ...e,
            archived,
            storedOrder: e.order,
            order: ranks.get(e.id) ?? e.order,
          })),
        );
      }
      warnings.push(...result.warnings);
    }
  }

  return { entries, warnings, fileCount };
}
