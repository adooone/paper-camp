import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type {
  EntityEntry,
  LogEntry,
  MarginNote,
  PhaseItem,
  SuggestionEntry,
  ThreadMessage,
} from '../../types/index';
import { SUGGESTION_ENTRY_RE } from '../parse/parser';
import {
  CLARIFICATIONS_SECTION,
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
  thread?: ThreadMessage[];
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
  appendSections(sections, [
    { entries: input.phases, section: PHASES_SECTION },
    { entries: input.thread, section: THREAD_SECTION },
  ]);
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

  const sections: string[] = [serializeFrontmatter(frontmatter)];
  const heading = `## ${input.id}: ${input.title}`;
  sections.push(input.body ? `${heading}\n\n${input.body}` : heading);
  appendSections(sections, [{ entries: input.log, section: LOG_SECTION }]);
  return sections.join('\n\n').trimEnd();
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
