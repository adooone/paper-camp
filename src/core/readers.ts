import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { IdeaEntry, ParseResult, ParseWarning, PlanEntry } from '../types/index';
import { parseIdeaFile, parseIdeas, parsePlanFile, parsePlans } from './parser';

// ---------------------------------------------------------------------------
// Per-file readers  (read all plan/idea files from a directory)
//
// Everything here touches the filesystem; the pure string -> data parsing it
// builds on lives in parser.ts.
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
 * Reads all per-file plans from a directory, including its `archive/` subdirectory
 * (done/dropped plans live there — see core/serializer.ts's archive move). Excludes
 * index.md in either directory.
 * Returns empty result if the directory doesn't exist or has no plan files.
 */
export async function readAllPlanFiles(
  plansDir: string,
): Promise<ParseResult<PlanEntry> & { fileCount: number }> {
  const entries: PlanEntry[] = [];
  const warnings: ParseWarning[] = [];
  let fileCount = 0;

  for (const dir of [plansDir, join(plansDir, 'archive')]) {
    const files = (await readdirMaybe(dir)).filter((f) => f.endsWith('.md') && f !== 'index.md');
    fileCount += files.length;
    for (const file of files) {
      const content = await readFileMaybe(join(dir, file));
      if (!content) {
        warnings.push({ title: file, message: 'Could not read plan file' });
        continue;
      }
      const result = parsePlanFile(content);
      entries.push(...result.entries);
      warnings.push(...result.warnings);
    }
  }

  return { entries, warnings, fileCount };
}

/**
 * Reads all per-file ideas from a directory (non-recursive, excludes index.md).
 */
export async function readAllIdeaFiles(
  ideasDir: string,
): Promise<ParseResult<IdeaEntry> & { fileCount: number }> {
  const entries: IdeaEntry[] = [];
  const warnings: ParseWarning[] = [];

  const files = (await readdirMaybe(ideasDir)).filter((f) => f.endsWith('.md') && f !== 'index.md');

  for (const file of files) {
    const content = await readFileMaybe(join(ideasDir, file));
    if (!content) {
      warnings.push({ title: file, message: 'Could not read idea file' });
      continue;
    }
    const result = parseIdeaFile(content);
    entries.push(...result.entries);
    warnings.push(...result.warnings);
  }

  return { entries, warnings, fileCount: files.length };
}

/**
 * Merges per-file plan entries with monolithic fallback, deduplicating by id/title.
 * Per-file entries take precedence; any plan in per-file that also exists in
 * the monolithic file is only included once (per-file version wins).
 */
export async function readPlansMerged(
  plansDir: string,
  monolithicPath: string,
): Promise<ParseResult<PlanEntry>> {
  const [perFileResult, monoRaw] = await Promise.all([
    readAllPlanFiles(plansDir),
    readFileMaybe(monolithicPath),
  ]);

  if (perFileResult.fileCount === 0) {
    return parsePlans(monoRaw);
  }

  const monoResult = parsePlans(monoRaw);
  const seen = new Set<string>();
  for (const e of perFileResult.entries) {
    seen.add(e.id ?? e.title);
  }
  const dedupedMono = monoResult.entries.filter((e) => {
    const key = e.id ?? e.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    entries: [...perFileResult.entries, ...dedupedMono],
    warnings: [...monoResult.warnings, ...perFileResult.warnings],
  };
}

/**
 * Merges per-file idea entries with monolithic fallback, deduplicating by id.
 */
export async function readIdeasMerged(
  ideasDir: string,
  monolithicPath: string,
): Promise<ParseResult<IdeaEntry>> {
  const [perFileResult, monoRaw] = await Promise.all([
    readAllIdeaFiles(ideasDir),
    readFileMaybe(monolithicPath),
  ]);

  if (perFileResult.fileCount === 0 && !monoRaw) {
    return { entries: [], warnings: perFileResult.warnings };
  }

  if (perFileResult.fileCount === 0) {
    return { entries: parseIdeas(monoRaw), warnings: perFileResult.warnings };
  }

  if (!monoRaw) {
    return perFileResult;
  }

  const monoEntries = parseIdeas(monoRaw);
  const seen = new Set<string>();
  for (const e of perFileResult.entries) {
    if (e.id) seen.add(e.id);
  }
  const dedupedMono = monoEntries.filter((e) => {
    if (!e.id) return true;
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  return {
    entries: [...perFileResult.entries, ...dedupedMono],
    warnings: [...perFileResult.warnings],
  };
}
