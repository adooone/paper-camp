import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NightFinding, NightFindingSeverity, NightSuggestionEntry } from '../types/index';
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

function formatNightFindingLine(entry: NightSuggestionEntry): string {
  const fields = [
    `check=${entry.check}`,
    `chunk=${entry.chunk}`,
    `file=${entry.file}`,
    `line=${entry.line ?? '-'}`,
    `commit=${entry.commit}`,
    `severity=${entry.severity}`,
  ];
  return `- night: ${entry.date} | ${fields.join(' | ')} | ${entry.message}`;
}

export function appendNightFindings(markdown: string, entries: NightSuggestionEntry[]): string {
  if (entries.length === 0) return markdown;
  const trimmed = markdown.trimEnd();
  const block = entries.map(formatNightFindingLine).join('\n');
  if (trimmed.includes(NIGHT_FINDINGS_HEADING)) return `${trimmed}\n${block}\n`;
  if (!trimmed) return `${NIGHT_FINDINGS_HEADING}\n${block}\n`;
  return `${trimmed}\n\n${NIGHT_FINDINGS_HEADING}\n${block}\n`;
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
