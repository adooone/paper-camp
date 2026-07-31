import type {
  LogEntry,
  MarginNote,
  MarginNoteAnchor,
  MarginNoteKind,
  PhaseItem,
  ThreadMessage,
  ThreadMessageKind,
} from '../types/index';

const SUB_HEADING_RE = /^#{2,3}\s+/;
const CHECKBOX_RE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const PHASE_SOURCE_RE = /^\[review\]\s+(.*)$/;
const DATED_ENTRY_RE = /^-\s+(\d{4}-\d{2}-\d{2}):\s*(.*)$/;
const NOTE_ANCHOR_RE = /^\[(?:phase:(\d+)|body)\]\s+(?:\[(decision|question)\]\s+)?(.*)$/;
const THREAD_LINE_RE =
  /^-\s+\[([ xX])\]\s+(?:(\d{4}-\d{2}-\d{2})\s+)?\[(log|clarification|review|note|decision|question)\]\s+(\[agent\]\s+)?(.*)$/;
const NOTE_STATE_KINDS: ThreadMessageKind[] = ['note', 'decision', 'question'];

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

function formatAnchor(anchor: MarginNoteAnchor): string {
  return anchor.kind === 'phase' ? `[phase:${anchor.index}]` : '[body]';
}

function parseNoteEntries(lines: string[], start: number, end: number): MarginNote[] {
  const notes: MarginNote[] = [];
  for (let i = start; i < end; i++) {
    const match = lines[i].match(CHECKBOX_RE);
    if (!match) continue;
    const anchorMatch = match[2].trim().match(NOTE_ANCHOR_RE);
    if (!anchorMatch) continue;
    const anchor: MarginNoteAnchor = anchorMatch[1]
      ? { kind: 'phase', index: Number(anchorMatch[1]) }
      : { kind: 'body' };
    const kind = anchorMatch[2] as MarginNoteKind | undefined;
    notes.push({
      anchor,
      prose: anchorMatch[3].trim(),
      state: match[1].toLowerCase() === 'x' ? 'resolved' : 'open',
      ...(kind ? { kind } : {}),
    });
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
  for (let i = start; i < end; i++) {
    const match = lines[i].match(THREAD_LINE_RE);
    if (!match) continue;
    const kind = match[3] as ThreadMessageKind;
    const message: ThreadMessage = { kind, text: match[5].trim() };
    if (match[2]) message.date = match[2];
    if (match[4]) message.from = 'agent';
    if (NOTE_STATE_KINDS.includes(kind)) {
      message.state = match[1].toLowerCase() === 'x' ? 'resolved' : 'open';
    }
    messages.push(message);
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
