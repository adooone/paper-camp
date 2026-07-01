import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { IdeaEntry, LogEntry, PhaseItem, PlanEntry } from '../types/index';

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

let idAssignmentChain: Promise<unknown> = Promise.resolve();

/**
 * Mints the next `<KIND>-<N>` plan ID from the persistent counter in `papercamp/config.json`,
 * incrementing and writing it back. Calls are chained through a module-level promise so two
 * near-simultaneous calls within this process never read the same counter value and mint a
 * duplicate ID — this does not protect against a concurrent call from a separate process (e.g.
 * the CLI racing the dev server), which is an accepted gap for a local single-user tool.
 * Returns undefined if the config file is missing or has no `nextId` counters yet.
 */
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
    const next = config.nextId[kind] ?? 1;
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
    lines.push('### Clarifications');
    for (const entry of input.clarifications) {
      lines.push(`- ${entry.date}: ${entry.text}`);
    }
    lines.push('');
  }
  if (input.phases && input.phases.length > 0) {
    lines.push('### Phases');
    for (const phase of input.phases) {
      const text = phase.source === 'review' ? `[review] ${phase.text}` : phase.text;
      lines.push(`- [${phase.done ? 'x' : ' '}] ${text}`);
      if (phase.description) {
        for (const paragraphLine of phase.description.split('\n')) {
          lines.push(`      ${paragraphLine}`);
        }
      }
    }
  }
  if (input.log && input.log.length > 0) {
    lines.push('', '### Log');
    for (const entry of input.log) {
      lines.push(`- ${entry.date}: ${entry.text}`);
    }
  }
  return lines.join('\n').trimEnd();
}

interface NewDecisionInput {
  title: string;
  date: string;
  status: string;
  supersededBy?: string;
  body?: string;
}

export function formatDecisionEntry(input: NewDecisionInput): string {
  const lines = [`## ${input.title}`, '', `**Date:** ${input.date}`, `**Status:** ${input.status}`];
  if (input.supersededBy) lines.push(`**Superseded-by:** ${input.supersededBy}`);
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

export function formatProgressEntry(date: string, items: string[]): string {
  return [`## ${date}`, ...items.map((item) => `- ${item}`)].join('\n');
}

/** Serializes an array of plan entries back to a plans.md file. */
export function formatPlans(entries: NewPlanInput[]): string {
  if (entries.length === 0) return '';
  return `${entries.map((entry) => formatPlanEntry(entry)).join('\n\n')}\n`;
}

/** Serializes an array of open-question entries back to an open-questions.md file. */
export function formatOpenQuestions(entries: NewOpenQuestionInput[]): string {
  if (entries.length === 0) return '';
  return `${entries.map((entry) => formatOpenQuestionEntry(entry)).join('\n\n')}\n`;
}

/** Appends a pre-formatted block to a papercamp file, separated by a single blank line. */
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

// ---------------------------------------------------------------------------
// YAML frontmatter serializers  (used by the per-file plan/idea format)
// ---------------------------------------------------------------------------

export function serializeFrontmatter(data: Record<string, unknown>): string {
  let yaml = stringifyYaml(data);
  // stringifyYaml adds trailing newline by default
  yaml = yaml.trimEnd();
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
  tags?: string[];
  body?: string;
  phases?: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
}

/**
 * Serializes a plan entry as a standalone file with YAML frontmatter.
 * Output format:
 *   ---
 *   id: FEAT-24
 *   kind: feat
 *   ...
 *   ---
 *   body...
 *
 *   ### Phases
 *   ...
 */
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
  if (input.tags && input.tags.length > 0) frontmatter.tags = input.tags;

  const sections: string[] = [serializeFrontmatter(frontmatter)];

  if (input.body) sections.push(input.body);

  if (input.clarifications && input.clarifications.length > 0) {
    const lines = ['### Clarifications'];
    for (const entry of input.clarifications) {
      lines.push(`- ${entry.date}: ${entry.text}`);
    }
    sections.push(lines.join('\n'));
  }

  if (input.phases && input.phases.length > 0) {
    const lines = ['### Phases'];
    for (const phase of input.phases) {
      const text = phase.source === 'review' ? `[review] ${phase.text}` : phase.text;
      lines.push(`- [${phase.done ? 'x' : ' '}] ${text}`);
      if (phase.description) {
        for (const descLine of phase.description.split('\n')) {
          lines.push(`      ${descLine}`);
        }
      }
    }
    sections.push(lines.join('\n'));
  }

  if (input.log && input.log.length > 0) {
    const lines = ['### Log'];
    for (const entry of input.log) {
      lines.push(`- ${entry.date}: ${entry.text}`);
    }
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n').trimEnd();
}

interface NewIdeaFileInput {
  id: string;
  title: string;
  body?: string;
}

/**
 * Serializes an idea entry as a standalone file with YAML frontmatter.
 */
export function formatIdeaFile(input: NewIdeaFileInput): string {
  const frontmatter: Record<string, unknown> = {
    id: input.id,
    title: input.title,
  };

  const parts: string[] = [serializeFrontmatter(frontmatter)];
  const heading = `## ${input.id}: ${input.title}`;
  parts.push(input.body ? `${heading}\n\n${input.body}` : heading);

  return parts.join('\n\n').trimEnd();
}

/**
 * Moves a per-file plan from papercamp/plans/<id>.md to papercamp/plans/archive/<id>.md.
 * This is a pure file move — no parse-and-re-serialize step.
 * Returns true if the file was moved, false if no per-file exists for this plan.
 */
export async function archivePlanFile(root: string, planId: string): Promise<boolean> {
  const plansDir = join(root, 'papercamp', 'plans');
  const archiveDir = join(plansDir, 'archive');
  const sourcePath = join(plansDir, `${planId}.md`);
  const destPath = join(archiveDir, `${planId}.md`);

  await mkdir(archiveDir, { recursive: true });

  try {
    await rename(sourcePath, destPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Index file generators  (papercamp/plans/index.md, papercamp/ideas/index.md)
// ---------------------------------------------------------------------------

export function formatPlansIndex(entries: PlanEntry[]): string {
  if (entries.length === 0) return '# Plans\n\nNo plans yet.\n';

  const sorted = [...entries].sort((a, b) => {
    const aNum = a.id ? Number.parseInt(a.id.replace(/^[A-Z]+-/, ''), 10) : Number.NaN;
    const bNum = b.id ? Number.parseInt(b.id.replace(/^[A-Z]+-/, ''), 10) : Number.NaN;
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return (a.title || '').localeCompare(b.title || '');
  });

  const rows = sorted.map(
    (e) =>
      `| ${e.id || ''} | ${(e.title || '').replace(/\|/g, '\\|')} | ${e.status} | ${(e.tags || []).join(', ')} |`,
  );

  return `# Plans\n\n| Id | Title | Status | Tags |\n|----|-------|--------|------|\n${rows.join('\n')}\n`;
}

export function formatIdeasIndex(ideas: IdeaEntry[]): string {
  if (ideas.length === 0) return '# Ideas\n\nNo ideas yet.\n';

  const sorted = [...ideas].sort((a, b) => {
    const aNum = a.id ? Number.parseInt(a.id.replace('IDEA-', ''), 10) : Number.NaN;
    const bNum = b.id ? Number.parseInt(b.id.replace('IDEA-', ''), 10) : Number.NaN;
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return (a.title || '').localeCompare(b.title || '');
  });

  const rows = sorted.map(
    (e) =>
      `| ${e.id || ''} | ${(e.title || '').replace(/\|/g, '\\|')} | ${e.status || 'planned'} |`,
  );

  return `# Ideas\n\n| Id | Title | Status |\n|----|-------|--------|\n${rows.join('\n')}\n`;
}
