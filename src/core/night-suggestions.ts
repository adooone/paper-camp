import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  NightFinding,
  NightFindingSeverity,
  NightReportGroup,
  NightSuggestionEntry,
  TaskLogEntry,
} from '../types/index';
import { hasFileChangedSince } from './night-worktree';

const SEVERITIES: NightFindingSeverity[] = ['critical', 'high', 'normal'];

export const NIGHT_FINDINGS_HEADING = '## Night findings';

const NIGHT_FINDING_RE = /^-\s+night:\s+(\d{4}-\d{2}-\d{2})\s+\|\s+(.*)$/;

function parseNightFindingLine(line: string): NightSuggestionEntry | undefined {
  const match = line.match(NIGHT_FINDING_RE);
  if (!match) return undefined;
  const [, date, rest] = match;
  const parts = rest.split(' | ');
  if (parts.length < 7) return undefined;

  const fields: Record<string, string> = {};
  for (const part of parts.slice(0, 6)) {
    const eq = part.indexOf('=');
    if (eq === -1) return undefined;
    fields[part.slice(0, eq)] = part.slice(eq + 1);
  }
  const { check, chunk, file, line: lineField, commit, severity } = fields;
  if (!check || !chunk || !file || !commit || !severity) return undefined;
  if (!SEVERITIES.includes(severity as NightFindingSeverity)) return undefined;

  const lineNumber = lineField && lineField !== '-' ? Number(lineField) : Number.NaN;
  const message = parts.slice(6).join(' | ').trim();
  if (!message) return undefined;

  return {
    date,
    check,
    chunk,
    file,
    line: Number.isInteger(lineNumber) ? lineNumber : null,
    commit,
    severity: severity as NightFindingSeverity,
    message,
  };
}

export function parseNightFindings(markdown: string): NightSuggestionEntry[] {
  const entries: NightSuggestionEntry[] = [];
  for (const line of markdown.split('\n')) {
    const entry = parseNightFindingLine(line);
    if (entry) entries.push(entry);
  }
  return entries;
}

function collapseNewlines(message: string): string {
  return message.replace(/\s*\n+\s*/g, ' ').trim();
}

function formatNightFindingLine(entry: NightSuggestionEntry): string {
  const fields = [
    `check=${entry.check}`,
    `chunk=${entry.chunk}`,
    `file=${entry.file}`,
    `line=${entry.line ?? '-'}`,
    `commit=${entry.commit}`,
    `severity=${entry.severity}`,
  ];
  return `- night: ${entry.date} | ${fields.join(' | ')} | ${collapseNewlines(entry.message)}`;
}

export function appendNightFindings(markdown: string, entries: NightSuggestionEntry[]): string {
  if (entries.length === 0) return markdown;
  const trimmed = markdown.trimEnd();
  const block = entries.map(formatNightFindingLine).join('\n');
  if (trimmed.includes(NIGHT_FINDINGS_HEADING)) return `${trimmed}\n${block}\n`;
  if (!trimmed) return `${NIGHT_FINDINGS_HEADING}\n${block}\n`;
  return `${trimmed}\n\n${NIGHT_FINDINGS_HEADING}\n${block}\n`;
}

function sameNightFinding(a: NightSuggestionEntry, b: NightSuggestionEntry): boolean {
  return (
    a.date === b.date &&
    a.check === b.check &&
    a.chunk === b.chunk &&
    a.file === b.file &&
    a.line === b.line &&
    a.commit === b.commit &&
    a.severity === b.severity &&
    a.message === b.message
  );
}

export function removeNightFindingLine(markdown: string, target: NightSuggestionEntry): string {
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseNightFindingLine(lines[i]);
    if (parsed && sameNightFinding(parsed, target)) {
      return [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n');
    }
  }
  return markdown;
}

export function buildNightReportGroups(
  findings: NightSuggestionEntry[],
  taskLog: TaskLogEntry[],
): NightReportGroup[] {
  const passesByDate = new Map<string, { passCount: number; costUsd: number }>();
  for (const entry of taskLog) {
    if (entry.taskKind !== 'night-review') continue;
    const date = entry.startedAt.slice(0, 10);
    const bucket = passesByDate.get(date) ?? { passCount: 0, costUsd: 0 };
    bucket.passCount += 1;
    bucket.costUsd += entry.usage?.costUsd ?? 0;
    passesByDate.set(date, bucket);
  }

  const findingsByDate = new Map<string, NightSuggestionEntry[]>();
  for (const finding of findings) {
    const list = findingsByDate.get(finding.date) ?? [];
    list.push(finding);
    findingsByDate.set(finding.date, list);
  }

  const dates = new Set([...passesByDate.keys(), ...findingsByDate.keys()]);
  const groups = [...dates].map(
    (date): NightReportGroup => ({
      date,
      passCount: passesByDate.get(date)?.passCount ?? 0,
      costUsd: passesByDate.get(date)?.costUsd ?? 0,
      findings: findingsByDate.get(date) ?? [],
    }),
  );

  return groups.sort((a, b) => b.date.localeCompare(a.date));
}

export async function readNightFindings(root: string): Promise<NightSuggestionEntry[]> {
  const raw = await readFile(join(root, 'papercamp', 'suggestions.md'), 'utf-8').catch(() => '');
  const entries = parseNightFindings(raw);
  const fresh: NightSuggestionEntry[] = [];
  for (const entry of entries) {
    const stale = await hasFileChangedSince(root, entry.file, entry.commit).catch(() => true);
    if (!stale) fresh.push(entry);
  }
  return fresh;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2),
  );
}

function textOverlapScore(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared += 1;
  return shared / Math.max(tokensA.size, tokensB.size);
}

const OVERLAP_THRESHOLD = 0.5;

export interface OpenIdeaCandidate {
  title: string;
  body: string;
}

export function isOverlappingFinding(
  finding: NightFinding,
  openIdeas: OpenIdeaCandidate[],
  earlierFindings: NightSuggestionEntry[],
): boolean {
  const matchesIdea = openIdeas.some(
    (idea) => textOverlapScore(finding.message, `${idea.title} ${idea.body}`) >= OVERLAP_THRESHOLD,
  );
  if (matchesIdea) return true;

  return earlierFindings.some(
    (earlier) =>
      earlier.file === finding.file &&
      textOverlapScore(finding.message, earlier.message) >= OVERLAP_THRESHOLD,
  );
}

export function dropOverlappingFindings(
  findings: NightFinding[],
  openIdeas: OpenIdeaCandidate[],
  earlierFindings: NightSuggestionEntry[],
): NightFinding[] {
  return findings.filter((finding) => !isOverlappingFinding(finding, openIdeas, earlierFindings));
}
