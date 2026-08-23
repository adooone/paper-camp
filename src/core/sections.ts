import type {
  LogEntry,
  MarginNote,
  MarginNoteAnchor,
  MarginNoteKind,
  PhaseItem,
  ThreadMessage,
  ThreadMessageKind,
} from '../types/index';
import { formatRunLine, parseRunLine } from './phase-run';

const SUB_HEADING_RE = /^#{2,3}\s+/;
const CHECKBOX_RE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const PHASE_SOURCE_RE = /^\[(review|manual|issue)\]\s+(.*)$/;
const RUN_LINE_RE = /^run:\s*(.+)$/;
const DATED_ENTRY_RE = /^-\s+(\d{4}-\d{2}-\d{2}):\s*(.*)$/;
const NOTE_ANCHOR_RE = /^\[(?:phase:(\d+)|body)\]\s+(?:\[(decision|question)\]\s+)?(.*)$/;
const THREAD_LINE_RE =
  /^-\s+\[([ xX])\]\s+(?:(\d{4}-\d{2}-\d{2})\s+)?\[(log|clarification|review|note|decision|question|chat)\]\s+(\[agent\]\s+)?(.*)$/;
const NOTE_STATE_KINDS: ThreadMessageKind[] = ['note', 'decision', 'question'];

/** Entry grammars match a single line, so a hand-wrapped entry would otherwise keep only
 * its first line; this folds the indented continuation lines back in before re-parsing. */
function foldContinuation(
  lines: string[],
  start: number,
  end: number,
  entryRe: RegExp,
): { text: string; next: number } {
  const parts: string[] = [];
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (line.trim() === '' || !/^\s/.test(line)) break;
    const trimmed = line.trimStart();
    if (entryRe.test(trimmed) || SUB_HEADING_RE.test(trimmed)) break;
    parts.push(trimmed);
    i++;
  }
  return { text: parts.join(' '), next: i };
}

function joinFolded(first: string, rest: string): string {
  return rest ? `${first.trim()} ${rest}` : first.trim();
}

function parsePhaseEntries(lines: string[], start: number, end: number): PhaseItem[] {
  const phases: PhaseItem[] = [];
  let i = start;
  while (i < end) {
    const match = lines[i].match(CHECKBOX_RE);
    if (match) {
      const done = match[1].toLowerCase() === 'x';
      const rawText = match[2].trim();
      const sourceMatch = rawText.match(PHASE_SOURCE_RE);
      const text = sourceMatch ? sourceMatch[2].trim() : rawText;
      const source = sourceMatch ? (sourceMatch[1] as PhaseItem['source']) : undefined;
      const descriptionLines: string[] = [];
      let run: PhaseItem['run'];
      i++;
      while (i < end) {
        const next = lines[i];
        if (next.trim() === '') break;
        if (CHECKBOX_RE.test(next) || SUB_HEADING_RE.test(next)) break;
        if (/^\s/.test(next)) {
          const trimmed = next.trimStart();
          const runMatch = trimmed.match(RUN_LINE_RE);
          const parsedRun = runMatch ? parseRunLine(runMatch[1]) : undefined;
          if (parsedRun) run = parsedRun;
          else descriptionLines.push(trimmed);
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
        run,
      });
    } else {
      i++;
    }
  }
  return phases;
}

function parseDatedEntries(lines: string[], start: number, end: number): LogEntry[] {
  const entries: LogEntry[] = [];
  let i = start;
  while (i < end) {
    const match = lines[i].match(DATED_ENTRY_RE);
    if (!match) {
      i++;
      continue;
    }
    const folded = foldContinuation(lines, i + 1, end, DATED_ENTRY_RE);
    entries.push({ date: match[1], text: joinFolded(match[2], folded.text) });
    i = folded.next;
  }
  return entries;
}

function formatPhaseLines(heading: string, phases: PhaseItem[]): string[] {
  const lines = [heading];
  for (const phase of phases) {
    const text = phase.source ? `[${phase.source}] ${phase.text}` : phase.text;
    lines.push(`- [${phase.done ? 'x' : ' '}] ${text}`);
    if (phase.description) {
      for (const descLine of phase.description.split('\n')) lines.push(`      ${descLine}`);
    }
    if (phase.run) lines.push(`      run: ${formatRunLine(phase.run)}`);
  }
  return lines;
}

function formatDatedLines(heading: string, entries: LogEntry[]): string[] {
  return [heading, ...entries.map((e) => `- ${e.date}: ${e.text}`)];
}

function formatAnchor(anchor: MarginNoteAnchor): string {
  return anchor.kind === 'phase' ? `[phase:${anchor.index}]` : '[body]';
}

function parseNoteEntries(lines: string[], start: number, end: number): MarginNote[] {
  const notes: MarginNote[] = [];
  let i = start;
  while (i < end) {
    const match = lines[i].match(CHECKBOX_RE);
    const anchorMatch = match ? match[2].trim().match(NOTE_ANCHOR_RE) : null;
    if (!match || !anchorMatch) {
      i++;
      continue;
    }
    const anchor: MarginNoteAnchor = anchorMatch[1]
      ? { kind: 'phase', index: Number(anchorMatch[1]) }
      : { kind: 'body' };
    const kind = anchorMatch[2] as MarginNoteKind | undefined;
    const folded = foldContinuation(lines, i + 1, end, CHECKBOX_RE);
    notes.push({
      anchor,
      prose: joinFolded(anchorMatch[3], folded.text),
      state: match[1].toLowerCase() === 'x' ? 'resolved' : 'open',
      ...(kind ? { kind } : {}),
    });
    i = folded.next;
  }
  return notes;
}

function formatNoteLines(notes: MarginNote[]): string[] {
  const lines = ['### Notes'];
  for (const note of notes) {
    const kindTag = note.kind && note.kind !== 'note' ? `[${note.kind}] ` : '';
    lines.push(
      `- [${note.state === 'resolved' ? 'x' : ' '}] ${formatAnchor(note.anchor)} ${kindTag}${note.prose}`,
    );
  }
  return lines;
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
  formatLines: (phases) => formatPhaseLines('### Phases', phases),
};

/** Same grammar as Phases — a checkbox list — but for post-build findings that
 * append below Phases without rewriting the plan's finished phase history. */
export const FIXES_SECTION: SectionDef<PhaseItem> = {
  headingRe: /^#{2,3}\s+Fixes\s*$/i,
  parseEntries: parsePhaseEntries,
  formatLines: (fixes) => formatPhaseLines('### Fixes', fixes),
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

export const NOTES_SECTION: SectionDef<MarginNote> = {
  headingRe: /^#{2,3}\s+Notes\s*$/i,
  parseEntries: parseNoteEntries,
  formatLines: formatNoteLines,
};

export const REVIEW_SECTION: SectionDef<LogEntry> = {
  headingRe: /^#{2,3}\s+Review\s*$/i,
  parseEntries: parseDatedEntries,
  formatLines: (entries) => formatDatedLines('### Review', entries),
};

function parseThreadEntries(lines: string[], start: number, end: number): ThreadMessage[] {
  const messages: ThreadMessage[] = [];
  let i = start;
  while (i < end) {
    const match = lines[i].match(THREAD_LINE_RE);
    if (!match) {
      i++;
      continue;
    }
    const kind = match[3] as ThreadMessageKind;
    const folded = foldContinuation(lines, i + 1, end, THREAD_LINE_RE);
    const message: ThreadMessage = { kind, text: joinFolded(match[5], folded.text) };
    if (match[2]) message.date = match[2];
    if (match[4]) message.from = 'agent';
    if (NOTE_STATE_KINDS.includes(kind)) {
      message.state = match[1].toLowerCase() === 'x' ? 'resolved' : 'open';
    }
    messages.push(message);
    i = folded.next;
  }
  return messages;
}

function formatThreadLines(messages: ThreadMessage[]): string[] {
  const lines = ['### Thread'];
  for (const m of messages) {
    const checked = m.state ? m.state === 'resolved' : true;
    const date = m.date ? `${m.date} ` : '';
    const author = m.from === 'agent' ? '[agent] ' : '';
    lines.push(`- [${checked ? 'x' : ' '}] ${date}[${m.kind}] ${author}${m.text}`);
  }
  return lines;
}

export const THREAD_SECTION: SectionDef<ThreadMessage> = {
  headingRe: /^#{2,3}\s+Thread\s*$/i,
  parseEntries: parseThreadEntries,
  formatLines: formatThreadLines,
};

export { SUB_HEADING_RE };
