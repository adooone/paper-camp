import type {
  DecisionEntry,
  OpenQuestionEntry,
  ParseResult,
  PhaseItem,
  PlanEntry,
  ProgressEntry,
  RawEntry,
} from '../types/index';
import { decisionFieldsSchema, openQuestionFieldsSchema, planFieldsSchema } from './schemas';

const HEADING_RE = /^##\s+(.+?)\s*$/;
const FIELD_RE = /^\*\*([A-Za-z][A-Za-z-]*):\*\*\s*(.*)$/;
const PHASES_HEADING_RE = /^###\s+Phases\s*$/i;
const SUB_HEADING_RE = /^#{2,3}\s+/;
const CHECKBOX_RE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;

function extractPhases(body: string): { body: string; phases: PhaseItem[] } {
  const lines = body.split('\n');
  const phasesStart = lines.findIndex((line) => PHASES_HEADING_RE.test(line));
  if (phasesStart === -1) {
    return { body, phases: [] };
  }

  let phasesEnd = lines.length;
  for (let i = phasesStart + 1; i < lines.length; i++) {
    if (SUB_HEADING_RE.test(lines[i])) {
      phasesEnd = i;
      break;
    }
  }

  const phases: PhaseItem[] = [];
  for (const line of lines.slice(phasesStart + 1, phasesEnd)) {
    const match = line.match(CHECKBOX_RE);
    if (match) {
      phases.push({ done: match[1].toLowerCase() === 'x', text: match[2].trim() });
    }
  }

  const remaining = [...lines.slice(0, phasesStart), ...lines.slice(phasesEnd)].join('\n').trim();
  return { body: remaining, phases };
}

/**
 * Splits a papercamp markdown file into `## Heading` blocks, each with an optional
 * `**Key:** value` fields block immediately below the heading, a prose body, and an
 * optional `### Phases` checkbox list. Used for plans.md, decisions.md, open-questions.md.
 */
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
    const { body, phases } = extractPhases(rawBody);

    entries.push({ title, fields, body, phases });
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
      body: raw.body,
    });
  }

  return { entries, warnings };
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
