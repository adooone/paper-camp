import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import type {
  ConsistencyIssue,
  DecisionEntry,
  EntityEntry,
  IdeaEntry,
  IdeaStatus,
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
// Read h2 OR h3 for these sections. The serializer only ever writes `###`, but
// generic markdown tooling (CodeRabbit, markdownlint) flags an h3 that isn't
// preceded by an h2 and "helpfully" demotes it to `##` — which previously made
// the whole section vanish silently. Accepting both means such an edit can't
// destroy phases/log data; the next serialize re-canonicalizes it back to `###`.
const PHASES_HEADING_RE = /^#{2,3}\s+Phases\s*$/i;
const LOG_HEADING_RE = /^#{2,3}\s+Log\s*$/i;
const CLARIFICATIONS_HEADING_RE = /^#{2,3}\s+Clarifications\s*$/i;
const SUB_HEADING_RE = /^#{2,3}\s+/;
const CHECKBOX_RE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const PHASE_SOURCE_RE = /^\[review\]\s+(.*)$/;
const LOG_ENTRY_RE = /^-\s+(\d{4}-\d{2}-\d{2}):\s*(.*)$/;

function extractSection<T>(
  body: string,
  headingRe: RegExp,
  parseFn: (lines: string[], start: number, end: number) => T[],
): { body: string; entries: T[] } {
  const lines = body.split('\n');
  const sectionStart = lines.findIndex((line) => headingRe.test(line));
  if (sectionStart === -1) return { body, entries: [] };

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (SUB_HEADING_RE.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  const entries = parseFn(lines, sectionStart + 1, sectionEnd);
  const remaining = [...lines.slice(0, sectionStart), ...lines.slice(sectionEnd)].join('\n').trim();
  return { body: remaining, entries };
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

function extractPhases(body: string): { body: string; phases: PhaseItem[] } {
  const result = extractSection(body, PHASES_HEADING_RE, parsePhaseEntries);
  return { body: result.body, phases: result.entries };
}

function parseDatedListEntries(
  lines: string[],
  start: number,
  end: number,
): import('../../types/index').LogEntry[] {
  const entries: import('../../types/index').LogEntry[] = [];
  for (let i = start; i < end; i++) {
    const match = lines[i].match(LOG_ENTRY_RE);
    if (match) {
      entries.push({ date: match[1], text: match[2].trim() });
    }
  }
  return entries;
}

function extractDatedList(
  body: string,
  headingRe: RegExp,
): { body: string; entries: import('../../types/index').LogEntry[] } {
  return extractSection(body, headingRe, parseDatedListEntries);
}

function extractLog(body: string): { body: string; log: import('../../types/index').LogEntry[] } {
  const { body: remaining, entries } = extractDatedList(body, LOG_HEADING_RE);
  return { body: remaining, log: entries };
}

function extractClarifications(body: string): {
  body: string;
  clarifications: import('../../types/index').LogEntry[];
} {
  const { body: remaining, entries } = extractDatedList(body, CLARIFICATIONS_HEADING_RE);
  return { body: remaining, clarifications: entries };
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
    let { body, phases } = extractPhases(rawBody);
    const { body: bodyAfterLog, log } = extractLog(body);
    body = bodyAfterLog;
    const { body: bodyAfterClarifications, clarifications } = extractClarifications(body);
    body = bodyAfterClarifications;

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

/**
 * Extracts and validates YAML frontmatter from a markdown string.
 * Returns the parsed data + body without warnings on success.
 * Returns partial data + warnings when frontmatter is absent, malformed,
 * or fails schema validation — never throws.
 */
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

/**
 * Parses a unified entity file: one file per entity — an "idea" for its whole
 * life, plan as an optional `### Phases` body section. Same body pipeline as
 * parsePlanFile (Phases/Log/Clarifications extraction); the frontmatter
 * differs: `type` instead of `kind`, no `idea:` backlink, and the note/status
 * asymmetry from the idea schema folded in.
 */
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

  let body = rawBody;
  const { body: bodyAfterPhases, phases } = extractPhases(body);
  body = bodyAfterPhases;
  const { body: bodyAfterLog, log } = extractLog(body);
  body = bodyAfterLog;
  const { body: bodyAfterClarifications, clarifications } = extractClarifications(body);
  body = bodyAfterClarifications;

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

  let body = rawBody;
  const { body: bodyAfterPhases, phases } = extractPhases(body);
  body = bodyAfterPhases;
  const { body: bodyAfterLog, log } = extractLog(body);
  body = bodyAfterLog;
  const { body: bodyAfterClarifications, clarifications } = extractClarifications(body);
  body = bodyAfterClarifications;

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

/**
 * Parse a single per-idea file with YAML frontmatter.
 */
export function parseIdeaFile(content: string): ParseResult<IdeaEntry> {
  const {
    data: frontmatter,
    body: rawBody,
    warnings: fmWarnings,
  } = parseFrontmatter(content, ideaFrontmatterSchema);

  if (!frontmatter) {
    return { entries: [], warnings: fmWarnings };
  }

  const { body, log } = extractLog(rawBody);

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

/** ideas.md is split into sections by `---` separators. Each section has an optional
 * `## IDEA-N:` heading prefix followed by a short title, and a prose body. */
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

/** Read-only cross-reference checks over already-parsed decisions/open-questions/plans —
 * dangling `resolved-by`/`superseded-by` titles, and open questions blocking an
 * already-active plan. */
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

/** progress.md is an append-only date log, not a record-based file — no fields, no validation. */
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
    } catch {
      // skip malformed line
    }
  }
  return entries;
}

export const SUGGESTION_ENTRY_RE = /^-\s+(\d{4}-\d{2}-\d{2}):\s+(.+?)\s+—\s+(.*)$/;

/**
 * suggestions.md is a flat, append-only line log — sibling to decisions.md/
 * open-questions.md/progress.md but with no `## Heading` per entry and no
 * `**Field:**` lines: each line already carries its own date, title, and a
 * one-line description (like plans' dated `### Log` grammar), and there is
 * no `id` or `status` since a suggestion never counts as a plan/idea until a
 * human promotes it.
 */
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
