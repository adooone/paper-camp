import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PhaseItem } from '../types/index';

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface NewPlanInput {
  title: string;
  status: string;
  created: string;
  updated?: string;
  tags?: string[];
  body?: string;
  phases?: PhaseItem[];
}

export function formatPlanEntry(input: NewPlanInput): string {
  const lines = [
    `## ${input.title}`,
    '',
    `**Status:** ${input.status}`,
    `**Created:** ${input.created}`,
  ];
  if (input.updated) lines.push(`**Updated:** ${input.updated}`);
  if (input.tags && input.tags.length > 0) lines.push(`**Tags:** ${input.tags.join(', ')}`);
  lines.push('');
  if (input.body) lines.push(input.body, '');
  if (input.phases && input.phases.length > 0) {
    lines.push('### Phases');
    for (const phase of input.phases) {
      lines.push(`- [${phase.done ? 'x' : ' '}] ${phase.text}`);
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
