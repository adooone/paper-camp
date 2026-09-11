import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ChunkHealth, ChunkSignals, NightConfig, NightHealthMap } from '../types/index';
import { runGit } from './git-log';
import { readNightFindings } from './night-suggestions';

const CHURN_WINDOW_DAYS = 30;
const CHURN_SATURATION = 20;
const SIZE_SATURATION_LINES = 3000;
const FINDINGS_SATURATION = 5;
const GAP_SATURATION_DAYS = 30;
const DEFAULT_ROOTS = ['src'];

function nightJsonPath(root: string): string {
  return join(root, 'papercamp', 'night.json');
}

async function readConfigNightRoots(root: string): Promise<string[] | undefined> {
  const raw = await readFile(join(root, 'papercamp', 'config.json'), 'utf-8').catch(() => null);
  if (!raw) return undefined;
  try {
    const roots = (JSON.parse(raw) as { night?: NightConfig }).night?.roots;
    return Array.isArray(roots) && roots.length > 0 ? roots : undefined;
  } catch {
    return undefined;
  }
}

interface PersistedChunk {
  lastReviewedAt: string | null;
  lastReviewedCommit: string | null;
}

async function readPersistedState(root: string): Promise<Map<string, PersistedChunk>> {
  const raw = await readFile(nightJsonPath(root), 'utf-8').catch(() => null);
  const state = new Map<string, PersistedChunk>();
  if (!raw) return state;
  try {
    const parsed = JSON.parse(raw) as { chunks?: Array<Partial<ChunkHealth>> };
    for (const chunk of parsed.chunks ?? []) {
      if (typeof chunk.path !== 'string') continue;
      state.set(chunk.path, {
        lastReviewedAt: typeof chunk.lastReviewedAt === 'string' ? chunk.lastReviewedAt : null,
        lastReviewedCommit:
          typeof chunk.lastReviewedCommit === 'string' ? chunk.lastReviewedCommit : null,
      });
    }
  } catch {
    return new Map();
  }
  return state;
}

async function listChunkPaths(root: string, roots: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (const dir of roots) {
    const dirents = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);
    for (const dirent of dirents) {
      if (dirent.isDirectory()) paths.push(`${dir}/${dirent.name}`);
    }
  }
  return paths;
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function countChunkLines(root: string, chunkPath: string): Promise<number> {
  const files = (await walkFiles(join(root, chunkPath))).filter((f) => /\.tsx?$/.test(f));
  let total = 0;
  for (const file of files) {
    const content = await readFile(file, 'utf-8').catch(() => '');
    if (content) total += content.split('\n').length;
  }
  return total;
}

export async function computeChurnByChunk(
  root: string,
  chunkPaths: string[],
): Promise<Map<string, number>> {
  const counts = new Map(chunkPaths.map((path) => [path, 0]));
  const output = await runGit(root, [
    'log',
    `--since=${CHURN_WINDOW_DAYS} days ago`,
    '--no-renames',
    '--numstat',
    '--format=%x02%H',
  ]);
  for (const block of output.split('\x02')) {
    if (!block.trim()) continue;
    const touched = new Set<string>();
    for (const line of block.split('\n').slice(1)) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const filePath = parts.slice(2).join('\t');
      for (const chunkPath of chunkPaths) {
        if (filePath.startsWith(`${chunkPath}/`)) touched.add(chunkPath);
      }
    }
    for (const chunkPath of touched) counts.set(chunkPath, (counts.get(chunkPath) ?? 0) + 1);
  }
  return counts;
}

interface CoverageFileEntry {
  lines?: { total?: number; covered?: number };
}

async function readCoverageSummary(
  root: string,
): Promise<Record<string, CoverageFileEntry> | null> {
  const raw = await readFile(join(root, 'coverage', 'coverage-summary.json'), 'utf-8').catch(
    () => null,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function chunkCoveragePct(
  summary: Record<string, CoverageFileEntry> | null,
  chunkAbsPath: string,
): number | null {
  if (!summary) return null;
  let total = 0;
  let covered = 0;
  for (const [filePath, entry] of Object.entries(summary)) {
    if (filePath === 'total') continue;
    if (filePath !== chunkAbsPath && !filePath.startsWith(`${chunkAbsPath}/`)) continue;
    total += entry.lines?.total ?? 0;
    covered += entry.lines?.covered ?? 0;
  }
  return total > 0 ? (covered / total) * 100 : null;
}

function daysSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const ms = Date.now() - Date.parse(dateIso);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scoreChunk(signals: ChunkSignals): number {
  const churnScore = clamp01(signals.churnCommits / CHURN_SATURATION);
  const sizeScore = clamp01(signals.lines / SIZE_SATURATION_LINES);
  const coverageScore =
    signals.coveragePct === null ? 0.5 : clamp01((100 - signals.coveragePct) / 100);
  const findingsScore = clamp01(signals.openFindings / FINDINGS_SATURATION);
  const gapScore =
    signals.daysSinceReviewed === null
      ? 1
      : clamp01(signals.daysSinceReviewed / GAP_SATURATION_DAYS);
  const average = (churnScore + sizeScore + coverageScore + findingsScore + gapScore) / 5;
  return Math.round(average * 100);
}

async function persistNightHealthMap(root: string, map: NightHealthMap): Promise<void> {
  const path = nightJsonPath(root);
  await mkdir(dirname(path), { recursive: true }).catch(() => {});
  await writeFile(path, `${JSON.stringify(map, null, 2)}\n`, 'utf-8').catch(() => {});
}

export async function computeNightHealthMap(root: string): Promise<NightHealthMap> {
  const roots = (await readConfigNightRoots(root)) ?? DEFAULT_ROOTS;
  const chunkPaths = await listChunkPaths(root, roots);
  const [persisted, churnByChunk, coverageSummary, openFindings] = await Promise.all([
    readPersistedState(root),
    computeChurnByChunk(root, chunkPaths),
    readCoverageSummary(root),
    readNightFindings(root),
  ]);
  const findingsByChunk = new Map<string, number>();
  for (const finding of openFindings) {
    findingsByChunk.set(finding.chunk, (findingsByChunk.get(finding.chunk) ?? 0) + 1);
  }

  const chunks = await Promise.all(
    chunkPaths.map(async (chunkPath): Promise<ChunkHealth> => {
      const prior = persisted.get(chunkPath) ?? { lastReviewedAt: null, lastReviewedCommit: null };
      const signals: ChunkSignals = {
        churnCommits: churnByChunk.get(chunkPath) ?? 0,
        lines: await countChunkLines(root, chunkPath),
        coveragePct: chunkCoveragePct(coverageSummary, join(root, chunkPath)),
        openFindings: findingsByChunk.get(chunkPath) ?? 0,
        daysSinceReviewed: daysSince(prior.lastReviewedAt),
      };
      return {
        path: chunkPath,
        score: scoreChunk(signals),
        signals,
        lastReviewedAt: prior.lastReviewedAt,
        lastReviewedCommit: prior.lastReviewedCommit,
      };
    }),
  );
  chunks.sort((a, b) => b.score - a.score);

  const map: NightHealthMap = { generatedAt: new Date().toISOString(), chunks };
  await persistNightHealthMap(root, map);
  return map;
}

export async function markChunkReviewed(
  root: string,
  chunkPath: string,
  commit: string,
  at: string = new Date().toISOString(),
): Promise<void> {
  const raw = await readFile(nightJsonPath(root), 'utf-8').catch(() => null);
  let map: NightHealthMap = { generatedAt: at, chunks: [] };
  if (raw) {
    try {
      map = JSON.parse(raw) as NightHealthMap;
    } catch {}
  }
  const existing = map.chunks.find((chunk) => chunk.path === chunkPath);
  if (existing) {
    existing.lastReviewedAt = at;
    existing.lastReviewedCommit = commit;
  } else {
    map.chunks.push({
      path: chunkPath,
      score: 0,
      signals: {
        churnCommits: 0,
        lines: 0,
        coveragePct: null,
        openFindings: 0,
        daysSinceReviewed: 0,
      },
      lastReviewedAt: at,
      lastReviewedCommit: commit,
    });
  }
  await persistNightHealthMap(root, map);
}

/** The chunks one night reviews: above the threshold, highest score first, at most
 *  `maxChunks`, skipping any already reviewed tonight. */
export function selectNightChunks(
  map: NightHealthMap,
  options: { threshold: number; maxChunks: number; exclude?: ReadonlySet<string> },
): ChunkHealth[] {
  return [...map.chunks]
    .filter((chunk) => chunk.score > options.threshold && !options.exclude?.has(chunk.path))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.maxChunks);
}
