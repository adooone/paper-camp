import { stringify as stringifyYaml } from 'yaml';
import type {
  LogEntry,
  MarginNote,
  PhaseItem,
  SuggestionEntry,
  ThreadMessage,
} from '../../types/index';
import { SUGGESTION_ENTRY_RE } from '../parse/parser';
import {
  CLARIFICATIONS_SECTION,
  FIXES_SECTION,
  LOG_SECTION,
  NOTES_SECTION,
  PHASES_SECTION,
  REVIEW_SECTION,
  type SectionDef,
  THREAD_SECTION,
} from '../sections';

interface SectionField {
  entries: any[] | undefined;
  section: SectionDef<any>;
}

function appendSections(sections: string[], fields: SectionField[]): void {
  for (const { entries, section } of fields) {
    if (entries && entries.length > 0) sections.push(section.formatLines(entries).join('\n'));
  }
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Every agent-authored thread message must carry `from: 'agent'` or it renders as the
// user's own message in the feedback chat. Build them through here so the field can't be
// forgotten at a call site.
export function agentThreadMessage(
  text: string,
  kind: ThreadMessage['kind'] = 'log',
): ThreadMessage {
  return {
    kind,
    date: todayDateString(),
    text,
    from: 'agent',
    ...(kind === 'question' ? { state: 'open' as const } : {}),
  };
}

interface NewPlanInput {
  title: string;
  status: string;
  kind?: string;
  id?: string;
  idea?: string;
  agent?: string;
  created: string;
  updated?: string;
  tags?: string[];
  body?: string;
  phases?: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
  notes?: MarginNote[];
}

export function formatPlanEntry(input: NewPlanInput): string {
  const header = [`## ${input.title}`, '', `**Status:** ${input.status}`];
  if (input.kind) header.push(`**Kind:** ${input.kind}`);
  if (input.id) header.push(`**Id:** ${input.id}`);
  if (input.idea) header.push(`**Idea:** ${input.idea}`);
  if (input.agent) header.push(`**Agent:** ${input.agent}`);
  header.push(`**Created:** ${input.created}`);
  if (input.updated) header.push(`**Updated:** ${input.updated}`);
  if (input.tags && input.tags.length > 0) header.push(`**Tags:** ${input.tags.join(', ')}`);

  const sections: string[] = [header.join('\n')];
  if (input.body) sections.push(input.body);
  appendSections(sections, [
    { entries: input.clarifications, section: CLARIFICATIONS_SECTION },
    { entries: input.phases, section: PHASES_SECTION },
    { entries: input.log, section: LOG_SECTION },
    { entries: input.notes, section: NOTES_SECTION },
  ]);
  return sections.join('\n\n').trimEnd();
}

export function formatPlans(entries: NewPlanInput[]): string {
  if (entries.length === 0) return '';
  return `${entries.map((entry) => formatPlanEntry(entry)).join('\n\n')}\n`;
}

export function serializeFrontmatter(data: Record<string, unknown>): string {
  const yaml = stringifyYaml(data).trimEnd();
  return `---\n${yaml}\n---`;
}

interface NewPlanFileInput {
  id: string;
  title: string;
  kind: string;
  status: string;
  idea?: string;
  agent?: string;
  created: string;
  updated?: string;
  audited?: string;
  auditedHash?: string;
  tags?: string[];
  body?: string;
  phases?: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
  notes?: MarginNote[];
}

export function formatPlanFile(input: NewPlanFileInput): string {
  const frontmatter: Record<string, unknown> = {
    id: input.id,
    title: input.title,
    kind: input.kind,
    status: input.status,
    created: input.created,
  };
  if (input.idea) frontmatter.idea = input.idea;
  if (input.agent) frontmatter.agent = input.agent;
  if (input.updated) frontmatter.updated = input.updated;
  if (input.audited) frontmatter.audited = input.audited;
  if (input.auditedHash) frontmatter['audited-hash'] = input.auditedHash;
  if (input.tags && input.tags.length > 0) frontmatter.tags = input.tags;

  const sections: string[] = [serializeFrontmatter(frontmatter)];
  if (input.body) sections.push(input.body);
  appendSections(sections, [
    { entries: input.clarifications, section: CLARIFICATIONS_SECTION },
    { entries: input.phases, section: PHASES_SECTION },
    { entries: input.log, section: LOG_SECTION },
    { entries: input.notes, section: NOTES_SECTION },
  ]);
  return sections.join('\n\n').trimEnd();
}

interface NewEntityFileInput {
  id: string;
  title: string;
  type?: string;
  // "note" for entities that never grow phases — notes use open/done/dropped status.
  // "fix" is a follow-up entity, linked to its parent via `idea`.
  kind?: string;
  status?: string;
  idea?: string;
  agent?: string;
  created: string;
  updated?: string;
  audited?: string;
  auditedHash?: string;
  released?: string;
  tags?: string[];
  subject?: string;
  order?: number;
  issueSource?: string;
  body?: string;
  phases?: PhaseItem[];
  fixes?: PhaseItem[];
  thread?: ThreadMessage[];
  // Frontmatter keys this paper-camp doesn't recognise, round-tripped from parseEntityFile
  // so a write never drops a field a newer version wrote — see entityFrontmatterKnownKeys.
  unknownFrontmatter?: Record<string, unknown>;
}

export function formatEntityFile(input: NewEntityFileInput): string {
  const frontmatter: Record<string, unknown> = {
    id: input.id,
    title: input.title,
  };
  if (input.type) frontmatter.type = input.type;
  if (input.kind) frontmatter.kind = input.kind;
  if (input.status) frontmatter.status = input.status;
  if (input.idea) frontmatter.idea = input.idea;
  frontmatter.created = input.created;
  if (input.agent) frontmatter.agent = input.agent;
  if (input.updated) frontmatter.updated = input.updated;
  if (input.audited) frontmatter.audited = input.audited;
  if (input.auditedHash) frontmatter['audited-hash'] = input.auditedHash;
  if (input.released) frontmatter.released = input.released;
  if (input.tags && input.tags.length > 0) frontmatter.tags = input.tags;
  if (input.subject) frontmatter.subject = input.subject;
  if (input.order !== undefined) frontmatter.order = input.order;
  if (input.issueSource) frontmatter.issueSource = input.issueSource;
  for (const key of Object.keys(input.unknownFrontmatter ?? {}).sort()) {
    frontmatter[key] = (input.unknownFrontmatter as Record<string, unknown>)[key];
  }

  const sections: string[] = [serializeFrontmatter(frontmatter)];
  if (input.body) sections.push(input.body);
  appendSections(sections, [
    { entries: input.phases, section: PHASES_SECTION },
    { entries: input.fixes, section: FIXES_SECTION },
    { entries: input.thread, section: THREAD_SECTION },
  ]);
  return sections.join('\n\n').trimEnd();
}

interface NewIdeaFileInput {
  id: string;
  title: string;
  // "note" for ideas that never need a plan — only notes may carry `status`.
  kind?: string;
  status?: string;
  body?: string;
  log?: LogEntry[];
}

export function formatIdeaFile(input: NewIdeaFileInput): string {
  const frontmatter: Record<string, unknown> = {
    id: input.id,
    title: input.title,
  };
  if (input.kind) frontmatter.kind = input.kind;
  if (input.status) frontmatter.status = input.status;

  const sections: string[] = [serializeFrontmatter(frontmatter)];
  const heading = `## ${input.id}: ${input.title}`;
  sections.push(input.body ? `${heading}\n\n${input.body}` : heading);
  appendSections(sections, [{ entries: input.log, section: LOG_SECTION }]);
  return sections.join('\n\n').trimEnd();
}

// Compares re-parsed fields, not a reconstructed string — parseSuggestions trims
// whitespace an LLM-authored line might contain, so a literal match could miss.
export function removeSuggestionLine(markdown: string, target: SuggestionEntry): string {
  let removed = false;
  const lines = markdown.split('\n').filter((line) => {
    if (!removed) {
      const match = line.match(SUGGESTION_ENTRY_RE);
      if (
        match &&
        match[1] === target.date &&
        match[2].trim() === target.title &&
        match[3].trim() === target.description
      ) {
        removed = true;
        return false;
      }
    }
    return true;
  });
  return removed ? lines.join('\n') : markdown;
}
