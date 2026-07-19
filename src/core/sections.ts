import type { LogEntry, PhaseItem } from '../types/index';

const SUB_HEADING_RE = /^#{2,3}\s+/;
const CHECKBOX_RE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const PHASE_SOURCE_RE = /^\[review\]\s+(.*)$/;
const DATED_ENTRY_RE = /^-\s+(\d{4}-\d{2}-\d{2}):\s*(.*)$/;

function parsePhaseEntries(lines: string[], start: number, end: number): PhaseItem[] {
  const phases: PhaseItem[] = [];
  let i = start;
  while (i < end) {
    const match = lines[i].match(CHECKBOX_RE);
    if (match) {
      const done = match[1].toLowerCase() === 'x';
      const rawText = match[2].trim();
      const sourceMatch = rawText.match(PHASE_SOURCE_RE);
      const text = sourceMatch ? sourceMatch[1].trim() : rawText;
      const source = sourceMatch ? ('review' as const) : undefined;
      const descriptionLines: string[] = [];
      i++;
      while (i < end) {
        const next = lines[i];
        if (next.trim() === '') break;
        if (CHECKBOX_RE.test(next) || SUB_HEADING_RE.test(next)) break;
        if (/^\s/.test(next)) {
          descriptionLines.push(next.trimStart());
          i++;
        } else {
          break;
        }
      }
      phases.push({
        done,
        text,
        description: descriptionLines.length > 0 ? descriptionLines.join('\n') : undefined,
        source,
      });
    } else {
      i++;
    }
  }
  return phases;
}

function parseDatedEntries(lines: string[], start: number, end: number): LogEntry[] {
  const entries: LogEntry[] = [];
  for (let i = start; i < end; i++) {
    const match = lines[i].match(DATED_ENTRY_RE);
    if (match) entries.push({ date: match[1], text: match[2].trim() });
  }
  return entries;
}

function formatPhaseLines(phases: PhaseItem[]): string[] {
  const lines = ['### Phases'];
  for (const phase of phases) {
    const text = phase.source === 'review' ? `[review] ${phase.text}` : phase.text;
    lines.push(`- [${phase.done ? 'x' : ' '}] ${text}`);
    if (phase.description) {
      for (const descLine of phase.description.split('\n')) lines.push(`      ${descLine}`);
    }
  }
  return lines;
}

function formatDatedLines(heading: string, entries: LogEntry[]): string[] {
  return [heading, ...entries.map((e) => `- ${e.date}: ${e.text}`)];
}

/** A section's parse and format sides share the same heading, so this is the one
 * table both `core/parse/parser.ts` and `core/serialize/serializer.ts` drive from.
 * Headings match h2 OR h3 on read: the serializer only ever writes `###`, but generic
 * markdown tooling (CodeRabbit, markdownlint) flags an h3 not preceded by an h2 and
 * "helpfully" demotes it to `##` — accepting both means such an edit can't destroy
 * phases/log data; the next serialize re-canonicalizes it back to `###`. */
export interface SectionDef<T> {
  headingRe: RegExp;
  parseEntries: (lines: string[], start: number, end: number) => T[];
  formatLines: (entries: T[]) => string[];
}

export const PHASES_SECTION: SectionDef<PhaseItem> = {
  headingRe: /^#{2,3}\s+Phases\s*$/i,
  parseEntries: parsePhaseEntries,
  formatLines: formatPhaseLines,
};

export const LOG_SECTION: SectionDef<LogEntry> = {
  headingRe: /^#{2,3}\s+Log\s*$/i,
  parseEntries: parseDatedEntries,
  formatLines: (entries) => formatDatedLines('### Log', entries),
};

export const CLARIFICATIONS_SECTION: SectionDef<LogEntry> = {
  headingRe: /^#{2,3}\s+Clarifications\s*$/i,
  parseEntries: parseDatedEntries,
  formatLines: (entries) => formatDatedLines('### Clarifications', entries),
};

export { SUB_HEADING_RE };
