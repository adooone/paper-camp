import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type {
  EntityEntry,
  LogEntry,
  MarginNote,
  PhaseItem,
  SuggestionEntry,
} from '../../types/index';
import { SUGGESTION_ENTRY_RE } from '../parse/parser';
import {
  CLARIFICATIONS_SECTION,
  LOG_SECTION,
  NOTES_SECTION,
  PHASES_SECTION,
  REVIEW_SECTION,
} from '../sections';

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

let idAssignmentChain: Promise<unknown> = Promise.resolve();

// Highest N already used by an existing `<PREFIX>-N.md` entity file on disk, across
// the live and archived entity dirs. Lets id assignment stay ahead of ids that were
// created out-of-band (e.g. a file written by hand or by a crashed run) without
// bumping the counter — otherwise the counter hands the same number out twice.
async function highestEntityIdOnDisk(campDir: string, kind: string): Promise<number> {
  const fileRe = new RegExp(`^${kind.toUpperCase()}-(\\d+)\\.md$`);
  const dirs = [
    join(campDir, 'ideas'),
    join(campDir, 'ideas', 'archive'),
    join(campDir, 'plans'),
    join(campDir, 'plans', 'archive'),
  ];
  let highest = 0;
  for (const dir of dirs) {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue; // dir may not exist (e.g. no plans/ in the unified-entity layout)
    }
    for (const file of files) {
      const match = fileRe.exec(file);
      if (match) highest = Math.max(highest, Number(match[1]));
    }
  }
  return highest;
}

// Chained through a module-level promise so two near-simultaneous calls in this process
// never read the same counter value; a concurrent second process is an accepted gap.
export async function assignPlanId(configPath: string, kind: string): Promise<string | undefined> {
  const run = idAssignmentChain.then(async () => {
    let config: { nextId?: Record<string, number> } | null = null;
    try {
      config = JSON.parse(await readFile(configPath, 'utf-8')) as {
        nextId?: Record<string, number>;
      };
    } catch {
      return undefined;
    }
    if (!config?.nextId) return undefined;
    // Take whichever is higher: the stored counter or one past the highest id already
    // on disk. This makes assignment collision-proof — a file that claimed an id
    // without advancing the counter can never cause the same id to be reused.
    const counter = config.nextId[kind] ?? 1;
    const highestOnDisk = await highestEntityIdOnDisk(dirname(configPath), kind);
    const next = Math.max(counter, highestOnDisk + 1);
    const id = `${kind.toUpperCase()}-${next}`;
    config.nextId[kind] = next + 1;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    return id;
  });
  idAssignmentChain = run.catch(() => undefined);
  return run;
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
  const lines = [`## ${input.title}`, '', `**Status:** ${input.status}`];
  if (input.kind) lines.push(`**Kind:** ${input.kind}`);
  if (input.id) lines.push(`**Id:** ${input.id}`);
  if (input.idea) lines.push(`**Idea:** ${input.idea}`);
  if (input.agent) lines.push(`**Agent:** ${input.agent}`);
  lines.push(`**Created:** ${input.created}`);
  if (input.updated) lines.push(`**Updated:** ${input.updated}`);
  if (input.tags && input.tags.length > 0) lines.push(`**Tags:** ${input.tags.join(', ')}`);
  lines.push('');
  if (input.body) lines.push(input.body, '');
  if (input.clarifications && input.clarifications.length > 0) {
    lines.push(...CLARIFICATIONS_SECTION.formatLines(input.clarifications), '');
  }
  if (input.phases && input.phases.length > 0) {
    lines.push(...PHASES_SECTION.formatLines(input.phases));
  }
  if (input.log && input.log.length > 0) {
    lines.push('', ...LOG_SECTION.formatLines(input.log));
  }
  if (input.notes && input.notes.length > 0) {
    lines.push('', ...NOTES_SECTION.formatLines(input.notes));
  }
  return lines.join('\n').trimEnd();
}

interface NewDecisionInput {
  title: string;
  date: string;
  status: string;
  supersededBy?: string;
  tags?: string[];
  body?: string;
}

export function formatDecisionEntry(input: NewDecisionInput): string {
  const lines = [`## ${input.title}`, '', `**Date:** ${input.date}`, `**Status:** ${input.status}`];
  if (input.supersededBy) lines.push(`**Superseded-by:** ${input.supersededBy}`);
  if (input.tags && input.tags.length > 0) lines.push(`**Tags:** ${input.tags.join(', ')}`);
  lines.push('');
  if (input.body) lines.push(input.body);
  return lines.join('\n').trimEnd();
}

interface NewOpenQuestionInput {
  title: string;
  raised: string;
  status: string;
  resolvedBy?: string;
  blocks?: string;
  body?: string;
}

export function formatOpenQuestionEntry(input: NewOpenQuestionInput): string {
  const lines = [
    `## ${input.title}`,
    '',
    `**Status:** ${input.status}`,
    `**Raised:** ${input.raised}`,
  ];
  if (input.resolvedBy) lines.push(`**Resolved-by:** ${input.resolvedBy}`);
  if (input.blocks) lines.push(`**Blocks:** ${input.blocks}`);
  lines.push('');
  if (input.body) lines.push(input.body);
  return lines.join('\n').trimEnd();
}

export function formatPlans(entries: NewPlanInput[]): string {
  if (entries.length === 0) return '';
  return `${entries.map((entry) => formatPlanEntry(entry)).join('\n\n')}\n`;
}

export function formatDecisions(entries: NewDecisionInput[]): string {
  if (entries.length === 0) return '';
  return `${entries.map((entry) => formatDecisionEntry(entry)).join('\n\n')}\n`;
}

export function formatOpenQuestions(entries: NewOpenQuestionInput[]): string {
  if (entries.length === 0) return '';
  return `${entries.map((entry) => formatOpenQuestionEntry(entry)).join('\n\n')}\n`;
}

export async function appendBlock(filePath: string, block: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  let existing = '';
  try {
    existing = await readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const trimmed = existing.trimEnd();
  const next = trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
  await writeFile(filePath, next, 'utf-8');
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

  if (input.clarifications && input.clarifications.length > 0) {
    sections.push(CLARIFICATIONS_SECTION.formatLines(input.clarifications).join('\n'));
  }

  if (input.phases && input.phases.length > 0) {
    sections.push(PHASES_SECTION.formatLines(input.phases).join('\n'));
  }

  if (input.log && input.log.length > 0) {
    sections.push(LOG_SECTION.formatLines(input.log).join('\n'));
  }

  if (input.notes && input.notes.length > 0) {
    sections.push(NOTES_SECTION.formatLines(input.notes).join('\n'));
  }

  return sections.join('\n\n').trimEnd();
}

interface NewEntityFileInput {
  id: string;
  title: string;
  type?: string;
  // "note" for entities that never grow phases — notes use open/done/dropped status.
  kind?: string;
  status?: string;
  agent?: string;
  created: string;
  updated?: string;
  audited?: string;
  auditedHash?: string;
  tags?: string[];
  subject?: string;
  order?: number;
  body?: string;
  phases?: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
  notes?: MarginNote[];
  review?: LogEntry[];
}

export function formatEntityFile(input: NewEntityFileInput): string {
  const frontmatter: Record<string, unknown> = {
    id: input.id,
    title: input.title,
  };
  if (input.type) frontmatter.type = input.type;
  if (input.kind) frontmatter.kind = input.kind;
  if (input.status) frontmatter.status = input.status;
  frontmatter.created = input.created;
  if (input.agent) frontmatter.agent = input.agent;
  if (input.updated) frontmatter.updated = input.updated;
  if (input.audited) frontmatter.audited = input.audited;
  if (input.auditedHash) frontmatter['audited-hash'] = input.auditedHash;
  if (input.tags && input.tags.length > 0) frontmatter.tags = input.tags;
  if (input.subject) frontmatter.subject = input.subject;
  if (input.order !== undefined) frontmatter.order = input.order;

  const sections: string[] = [serializeFrontmatter(frontmatter)];

  if (input.body) sections.push(input.body);

  if (input.clarifications && input.clarifications.length > 0) {
    sections.push(CLARIFICATIONS_SECTION.formatLines(input.clarifications).join('\n'));
  }

  if (input.phases && input.phases.length > 0) {
    sections.push(PHASES_SECTION.formatLines(input.phases).join('\n'));
  }

  if (input.log && input.log.length > 0) {
    sections.push(LOG_SECTION.formatLines(input.log).join('\n'));
  }

  if (input.notes && input.notes.length > 0) {
    sections.push(NOTES_SECTION.formatLines(input.notes).join('\n'));
  }

  if (input.review && input.review.length > 0) {
    sections.push(REVIEW_SECTION.formatLines(input.review).join('\n'));
  }

  return sections.join('\n\n').trimEnd();
}

export async function assignEntityId(configPath: string): Promise<string | undefined> {
  return assignPlanId(configPath, 'idea');
}

// Chained alongside id assignment so a candidate promote's id-mint and subject-create
// writes to the same config.json can't clobber each other.
export async function ensureSubject(configPath: string, subject: string): Promise<void> {
  const run = idAssignmentChain.then(async () => {
    let config: { subjects?: string[] } | null = null;
    try {
      config = JSON.parse(await readFile(configPath, 'utf-8')) as { subjects?: string[] };
    } catch {
      return;
    }
    const subjects = config.subjects ?? [];
    if (subjects.includes(subject)) return;
    config.subjects = [...subjects, subject];
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  });
  idAssignmentChain = run.catch(() => undefined);
  return run;
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

  const parts: string[] = [serializeFrontmatter(frontmatter)];
  const heading = `## ${input.id}: ${input.title}`;
  parts.push(input.body ? `${heading}\n\n${input.body}` : heading);

  if (input.log && input.log.length > 0) {
    parts.push(LOG_SECTION.formatLines(input.log).join('\n'));
  }

  return parts.join('\n\n').trimEnd();
}

export async function archiveEntityFile(root: string, entityId: string): Promise<boolean> {
  const ideasDir = join(root, 'papercamp', 'ideas');
  const archiveDir = join(ideasDir, 'archive');
  const sourcePath = join(ideasDir, `${entityId}.md`);
  const destPath = join(archiveDir, `${entityId}.md`);

  await mkdir(archiveDir, { recursive: true });

  try {
    await rename(sourcePath, destPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
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

export function formatEntitiesIndex(entities: EntityEntry[]): string {
  if (entities.length === 0) return '# Ideas\n\nNo ideas yet.\n';

  const sorted = [...entities].sort((a, b) => {
    const aNum = Number.parseInt(a.id.replace(/^[A-Z]+-/, ''), 10);
    const bNum = Number.parseInt(b.id.replace(/^[A-Z]+-/, ''), 10);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return a.title.localeCompare(b.title);
  });

  const rows = sorted.map(
    (e) =>
      `| ${e.id} | ${e.title.replace(/\|/g, '\\|')} | ${e.type ?? (e.kind === 'note' ? 'note' : '—')} | ${e.status} | ${(e.tags ?? []).join(', ')} |`,
  );

  return `# Ideas\n\n| Id | Title | Type | Status | Tags |\n|----|-------|------|--------|------|\n${rows.join('\n')}\n`;
}
