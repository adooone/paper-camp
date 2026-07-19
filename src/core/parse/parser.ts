import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import type {
  ConsistencyIssue,
  DecisionEntry,
  EntityEntry,
  IdeaEntry,
  IdeaStatus,
  LogEntry,
  OpenQuestionEntry,
  ParseResult,
  ParseWarning,
  PhaseItem,
  PlanEntry,
  ProgressEntry,
  RawEntry,
  SuggestionEntry,
  TaskLogEntry,
} from '../../types/index';
import { CLARIFICATIONS_SECTION, LOG_SECTION, PHASES_SECTION, type SectionDef } from '../sections';
import {
  decisionFieldsSchema,
  entityFrontmatterSchema,
  ideaFrontmatterSchema,
  openQuestionFieldsSchema,
  planFieldsSchema,
  planFrontmatterSchema,
} from './schemas';

const HEADING_RE = /^##\s+(.+?)\s*$/;
const FIELD_RE = /^\*\*([A-Za-z][A-Za-z-]*):\*\*\s*(.*)$/;
const SUB_HEADING_RE = /^#{2,3}\s+/;

function extractSection<T>(body: string, section: SectionDef<T>): { body: string; entries: T[] } {
  const lines = body.split('\n');
  const sectionStart = lines.findIndex((line) => section.headingRe.test(line));
  if (sectionStart === -1) return { body, entries: [] };

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (SUB_HEADING_RE.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  const entries = section.parseEntries(lines, sectionStart + 1, sectionEnd);
  const remaining = [...lines.slice(0, sectionStart), ...lines.slice(sectionEnd)].join('\n').trim();
  return { body: remaining, entries };
}

/** Every entry file (plan, entity, raw ## block) carries the same three optional
 * trailing sections in the same order — extract them together so callers stop
 * re-spelling the phases/log/clarifications sequence three times. */
function extractStandardSections(body: string): {
  body: string;
  phases: PhaseItem[];
  log: LogEntry[];
  clarifications: LogEntry[];
} {
  const afterPhases = extractSection(body, PHASES_SECTION);
  const afterLog = extractSection(afterPhases.body, LOG_SECTION);
  const afterClarifications = extractSection(afterLog.body, CLARIFICATIONS_SECTION);
  return {
    body: afterClarifications.body,
    phases: afterPhases.entries,
    log: afterLog.entries,
    clarifications: afterClarifications.entries,
  };
}

export function parseRawEntries(markdown: string): RawEntry[] {
  const lines = markdown.split('\n');
  const headingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (HEADING_RE.test(lines[i])) {
      headingIndices.push(i);
    }
  }

  const entries: RawEntry[] = [];
  for (let h = 0; h < headingIndices.length; h++) {
    const start = headingIndices[h];
    const end = h + 1 < headingIndices.length ? headingIndices[h + 1] : lines.length;
    const title = lines[start].match(HEADING_RE)![1];
    const block = lines.slice(start + 1, end);

    let cursor = 0;
    while (cursor < block.length && block[cursor].trim() === '') cursor++;

    const fields: Record<string, string> = {};
    while (cursor < block.length) {
      const match = block[cursor].match(FIELD_RE);
      if (!match) break;
      fields[match[1].toLowerCase()] = match[2].trim();
      cursor++;
    }

    while (cursor < block.length && block[cursor].trim() === '') cursor++;

    const rawBody = block.slice(cursor).join('\n').trim();
    const { body, phases, log, clarifications } = extractStandardSections(rawBody);

    entries.push({ title, fields, body, phases, log, clarifications });
  }

  return entries;
}

export function parsePlans(markdown: string): ParseResult<PlanEntry> {
  const entries: PlanEntry[] = [];
  const warnings: ParseResult<PlanEntry>['warnings'] = [];

  for (const raw of parseRawEntries(markdown)) {
    const result = planFieldsSchema.safeParse(raw.fields);
    if (!result.success) {
      warnings.push({
        title: raw.title,
        message: result.error.issues.map((i) => i.message).join('; '),
      });
      continue;
    }
    const fields = result.data;
    entries.push({
      title: raw.title,
      status: fields.status,
      kind: fields.kind,
      id: fields.id,
      idea: fields.idea,
      agent: fields.agent,
      created: fields.created,
      updated: fields.updated,
      tags: fields.tags
        ? fields.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      body: raw.body,
      phases: raw.phases,
      log: raw.log,
      clarifications: raw.clarifications,
    });
  }

  return { entries, warnings };
}

export function parseDecisions(markdown: string): ParseResult<DecisionEntry> {
  const entries: DecisionEntry[] = [];
  const warnings: ParseResult<DecisionEntry>['warnings'] = [];

  for (const raw of parseRawEntries(markdown)) {
    const result = decisionFieldsSchema.safeParse(raw.fields);
    if (!result.success) {
      warnings.push({
        title: raw.title,
        message: result.error.issues.map((i) => i.message).join('; '),
      });
      continue;
    }
    const fields = result.data;
    entries.push({
      title: raw.title,
      date: fields.date,
      status: fields.status,
      supersededBy: fields['superseded-by'],
      body: raw.body,
    });
  }

  return { entries, warnings };
}

export function parseOpenQuestions(markdown: string): ParseResult<OpenQuestionEntry> {
  const entries: OpenQuestionEntry[] = [];
  const warnings: ParseResult<OpenQuestionEntry>['warnings'] = [];

  for (const raw of parseRawEntries(markdown)) {
    const result = openQuestionFieldsSchema.safeParse(raw.fields);
    if (!result.success) {
      warnings.push({
        title: raw.title,
        message: result.error.issues.map((i) => i.message).join('; '),
      });
      continue;
    }
    const fields = result.data;
    entries.push({
      title: raw.title,
      status: fields.status,
      raised: fields.raised,
      resolvedBy: fields['resolved-by'],
      blocks: fields.blocks,
      body: raw.body,
    });
  }

  return { entries, warnings };
}

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/;

export function parseFrontmatter<T>(
  content: string,
  schema: z.ZodType<T>,
): { data: T | null; body: string; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];

  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { data: null, body: content.trim(), warnings };
  }

  const yamlStr = match[1];
  const body = content.slice(match[0].length).trim();

  let parsed: unknown;
  try {
    parsed = parseYaml(yamlStr);
  } catch (err) {
    warnings.push({
      title: '(frontmatter)',
      message: `Invalid YAML frontmatter: ${(err as Error).message}`,
    });
    return { data: null, body, warnings };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    warnings.push({
      title: '(frontmatter)',
      message: 'YAML frontmatter did not produce an object',
    });
    return { data: null, body, warnings };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const title = (parsed as Record<string, unknown>).id as string | undefined;
    warnings.push({
      title: title ?? '(frontmatter)',
      message: result.error.issues.map((i) => i.message).join('; '),
    });
    return { data: null, body, warnings };
  }

  return { data: result.data, body, warnings };
}

export function parseEntityFile(content: string): ParseResult<EntityEntry> {
  const warnings: ParseWarning[] = [];
  const {
    data: frontmatter,
    body: rawBody,
    warnings: fmWarnings,
  } = parseFrontmatter(content, entityFrontmatterSchema);
  warnings.push(...fmWarnings);

  if (!frontmatter) {
    return { entries: [], warnings };
  }

  const { body, phases, log, clarifications } = extractStandardSections(rawBody);

  if (frontmatter.kind === 'note' && phases.length > 0) {
    warnings.push({
      title: frontmatter.title,
      message: 'note entities must not carry a Phases section — kept, but fix the file',
    });
  }

  const entry: EntityEntry = {
    id: frontmatter.id,
    title: frontmatter.title,
    type: frontmatter.type,
    kind: frontmatter.kind,
    status: frontmatter.status,
    agent: frontmatter.agent,
    created: frontmatter.created,
    updated: frontmatter.updated,
    audited: frontmatter.audited,
    auditedHash: frontmatter['audited-hash'],
    tags: frontmatter.tags ?? [],
    subject: frontmatter.subject,
    order: frontmatter.order,
    body,
    phases,
    log,
    clarifications,
  };

  return { entries: [entry], warnings };
}

export function parsePlanFile(content: string): ParseResult<PlanEntry> {
  const warnings: ParseWarning[] = [];
  const {
    data: frontmatter,
    body: rawBody,
    warnings: fmWarnings,
  } = parseFrontmatter(content, planFrontmatterSchema);
  warnings.push(...fmWarnings);

  if (!frontmatter) {
    return { entries: [], warnings };
  }

  const { body, phases, log, clarifications } = extractStandardSections(rawBody);

  const entry: PlanEntry = {
    title: frontmatter.title,
    status: frontmatter.status,
    kind: frontmatter.kind,
    id: frontmatter.id,
    idea: frontmatter.idea,
    agent: frontmatter.agent,
    created: frontmatter.created,
    updated: frontmatter.updated,
    audited: frontmatter.audited,
    auditedHash: frontmatter['audited-hash'],
    tags: frontmatter.tags ?? [],
    body,
    phases,
    log,
    clarifications,
  };

  return { entries: [entry], warnings };
}

export function parseIdeaFile(content: string): ParseResult<IdeaEntry> {
  const {
    data: frontmatter,
    body: rawBody,
    warnings: fmWarnings,
  } = parseFrontmatter(content, ideaFrontmatterSchema);

  if (!frontmatter) {
    return { entries: [], warnings: fmWarnings };
  }

  const { body, entries: log } = extractSection(rawBody, LOG_SECTION);

  const entry: IdeaEntry = {
    id: frontmatter.id,
    title: frontmatter.title,
    body: body || '',
    ...(frontmatter.kind && { kind: frontmatter.kind }),
    ...(frontmatter.status && { status: frontmatter.status }),
    ...(log.length > 0 && { log }),
  };

  return { entries: [entry], warnings: fmWarnings };
}

const IDEA_ID_RE = /^(IDEA-\d+):\s*/;

const IDEA_SEPARATOR_RE = /\n---+\n/;

export function parseIdeas(markdown: string): IdeaEntry[] {
  const sections = markdown.split(IDEA_SEPARATOR_RE).filter(Boolean);
  return sections.map((section) => {
    const headingMatch = section.match(/^#{1,3}\s+(.+)/m);
    const rawTitle = headingMatch
      ? headingMatch[1].trim()
      : (section.trim().split('\n')[0]?.trim() ?? 'Untitled');
    const idMatch = rawTitle.match(IDEA_ID_RE);
    const id = idMatch?.[1] ?? null;
    const title = id ? rawTitle.slice(idMatch![0].length) : rawTitle;
    return { id, title, body: section.trim() };
  });
}

export function findConsistencyIssues(
  decisions: DecisionEntry[],
  openQuestions: OpenQuestionEntry[],
  plans: PlanEntry[],
): ConsistencyIssue[] {
  const decisionTitles = new Set(decisions.map((d) => d.title));
  const issues: ConsistencyIssue[] = [];

  for (const decision of decisions) {
    if (decision.supersededBy && !decisionTitles.has(decision.supersededBy)) {
      issues.push({
        kind: 'dangling-superseded-by',
        section: 'decisions',
        title: decision.title,
        message: `Superseded-by "${decision.supersededBy}" doesn't match any decision`,
      });
    }
  }

  for (const question of openQuestions) {
    if (question.resolvedBy && !decisionTitles.has(question.resolvedBy)) {
      issues.push({
        kind: 'dangling-resolved-by',
        section: 'open-questions',
        title: question.title,
        message: `Resolved-by "${question.resolvedBy}" doesn't match any decision`,
      });
    }
    if (question.status === 'open' && question.blocks) {
      const blockedPlan = plans.find((p) => p.id === question.blocks);
      if (
        blockedPlan &&
        (blockedPlan.status === 'in-progress' || blockedPlan.status === 'review')
      ) {
        issues.push({
          kind: 'blocked-plan-active',
          section: 'open-questions',
          title: question.title,
          planId: blockedPlan.id,
          message: `Still open but blocks "${blockedPlan.title}" (${blockedPlan.id}), already ${blockedPlan.status}`,
        });
      }
    }
  }

  return issues;
}

const PROGRESS_HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const BULLET_RE = /^[-*]\s+(.*)$/;

export function parseProgress(markdown: string): ProgressEntry[] {
  const lines = markdown.split('\n');
  const headingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (PROGRESS_HEADING_RE.test(lines[i])) {
      headingIndices.push(i);
    }
  }

  const entries: ProgressEntry[] = [];
  for (let h = 0; h < headingIndices.length; h++) {
    const start = headingIndices[h];
    const end = h + 1 < headingIndices.length ? headingIndices[h + 1] : lines.length;
    const date = lines[start].match(PROGRESS_HEADING_RE)![1];
    const items = lines
      .slice(start + 1, end)
      .map((line) => line.match(BULLET_RE))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1].trim());

    entries.push({ date, items });
  }

  return entries;
}

/** tasks.log is JSON Lines — one TaskLogEntry per line. Skip lines that fail to parse rather than fail the whole read (a truncated last line from a crash shouldn't hide the rest). */
export function parseTaskLog(raw: string): TaskLogEntry[] {
  const entries: TaskLogEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as TaskLogEntry);
    } catch {}
  }
  return entries;
}

export const SUGGESTION_ENTRY_RE = /^-\s+(\d{4}-\d{2}-\d{2}):\s+(.+?)\s+—\s+(.*)$/;

// No `id`/`status` fields: a suggestion isn't a plan/idea until a human promotes it.
export function parseSuggestions(markdown: string): SuggestionEntry[] {
  const entries: SuggestionEntry[] = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(SUGGESTION_ENTRY_RE);
    if (match) {
      entries.push({ date: match[1], title: match[2].trim(), description: match[3].trim() });
    }
  }
  return entries;
}
