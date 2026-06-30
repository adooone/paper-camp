#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Command } from 'commander';
import { deriveIdeaStatuses } from '../core/idea-status';
import { parseIdeas, parsePlans, readAllIdeaFiles, readAllPlanFiles } from '../core/parser';
import { AlreadyInitializedError, PAPER_CAMP_VERSION, initProject } from '../core/scaffold';
import {
  assignPlanId,
  formatIdeaFile,
  formatIdeasIndex,
  formatPlanFile,
  formatPlansIndex,
  todayDateString,
} from '../core/serializer';
import { PLAN_KINDS } from '../types/index';
import { startDevServer } from './dev-server';

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const program = new Command();

program
  .name('paper-camp')
  .description('Local-first, AI-native project companion.')
  .version(PAPER_CAMP_VERSION);

program
  .command('init [project-name]')
  .description('Initialize Paper Camp in the current directory')
  .option('-i, --intent <text>', 'one-line description of what you are building')
  .action(async (projectName: string | undefined, opts: { intent?: string }) => {
    const targetDir = process.cwd();
    const name = projectName ?? basename(targetDir);
    try {
      await initProject(targetDir, { projectName: name, intent: opts.intent });
      console.log(`Initialized Paper Camp in ${targetDir}`);
      console.log('  papercamp/config.json');
      console.log('  papercamp/plans/          (per-file plan entries)');
      console.log('  papercamp/plans/index.md');
      console.log('  papercamp/plans/archive/');
      console.log('  papercamp/ideas/          (per-file idea entries)');
      console.log('  papercamp/ideas/index.md');
      console.log('  papercamp/progress.md, decisions.md, open-questions.md');
    } catch (error) {
      if (error instanceof AlreadyInitializedError) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  });

program
  .command('dev')
  .description('Start the local dashboard')
  .option('-p, --port <number>', 'port to listen on', '3333')
  .action(async (opts: { port: string }) => {
    const port = Number(opts.port);
    const root = process.cwd();
    try {
      await startDevServer({ root, port });
      console.log(`Paper Camp dashboard running at http://localhost:${port}`);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
  });

program
  .command('add <type> [name]')
  .description('Add a new entry (currently supports: plan)')
  .option('-k, --kind <kind>', `plan kind (${PLAN_KINDS.join('|')})`, 'feat')
  .action(async (type: string, name: string | undefined, opts: { kind: string }) => {
    if (type !== 'plan') {
      console.error(`Unknown type "${type}". Supported types: plan`);
      process.exitCode = 1;
      return;
    }
    if (!name) {
      console.error('Usage: paper-camp add plan <name> [--kind feat|fix|chore|docs|refactor]');
      process.exitCode = 1;
      return;
    }
    if (!PLAN_KINDS.includes(opts.kind as (typeof PLAN_KINDS)[number])) {
      console.error(`Unknown kind "${opts.kind}". Supported kinds: ${PLAN_KINDS.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    const kind = opts.kind;
    const root = process.cwd();
    const configPath = resolve(root, 'papercamp', 'config.json');
    const id = await assignPlanId(configPath, kind);

    if (!id) {
      console.error('Could not assign plan ID — is the project initialized?');
      process.exitCode = 1;
      return;
    }

    const plansDir = resolve(root, 'papercamp', 'plans');
    await mkdir(plansDir, { recursive: true });

    const planContent = formatPlanFile({
      id,
      title: name,
      kind,
      status: 'idea',
      created: todayDateString(),
    });
    await writeFile(join(plansDir, `${id}.md`), `${planContent}\n`, 'utf-8');

    // Regenerate index
    const { entries } = await readAllPlanFiles(plansDir);
    await writeFile(join(plansDir, 'index.md'), formatPlansIndex(entries), 'utf-8');

    console.log(`Added plan "${name}" (${id}) to papercamp/plans/${id}.md`);
  });

program
  .command('migrate')
  .description(
    'One-time migration: split monolithic plans.md/ideas.md into per-file YAML frontmatter entries',
  )
  .action(async () => {
    const root = process.cwd();
    const plansDir = resolve(root, 'papercamp', 'plans');
    const archiveDir = join(plansDir, 'archive');
    const ideasDir = resolve(root, 'papercamp', 'ideas');
    await mkdir(archiveDir, { recursive: true });
    await mkdir(ideasDir, { recursive: true });

    const plansPath = resolve(root, 'papercamp', 'plans.md');
    const ideasPath = resolve(root, 'papercamp', 'ideas.md');

    let migratedPlans = 0;
    let skippedPlans = 0;
    let planWarnings = 0;
    const plansRaw = await readFile(plansPath, 'utf-8').catch(() => '');
    if (plansRaw.trim()) {
      const { entries, warnings } = parsePlans(plansRaw);
      planWarnings = warnings.length;
      for (const warning of warnings) {
        console.warn(`  warning: ${warning.title}: ${warning.message}`);
      }
      for (const entry of entries) {
        if (!entry.id) {
          console.warn(`  skipping plan "${entry.title}" — no Id assigned, cannot migrate`);
          skippedPlans++;
          continue;
        }
        const targetDir =
          entry.status === 'done' || entry.status === 'dropped' ? archiveDir : plansDir;
        const targetFile = join(targetDir, `${entry.id}.md`);
        if (await exists(targetFile)) {
          skippedPlans++;
          continue;
        }
        const content = formatPlanFile({
          id: entry.id,
          title: entry.title,
          kind: entry.kind ?? 'feat',
          status: entry.status,
          idea: entry.idea,
          agent: entry.agent,
          created: entry.created,
          updated: entry.updated,
          tags: entry.tags,
          body: entry.body,
          phases: entry.phases,
          log: entry.log,
          clarifications: entry.clarifications,
        });
        await writeFile(targetFile, `${content}\n`, 'utf-8');
        migratedPlans++;
      }
    }

    let migratedIdeas = 0;
    let skippedIdeas = 0;
    const ideasRaw = await readFile(ideasPath, 'utf-8').catch(() => '');
    if (ideasRaw.trim()) {
      const entries = parseIdeas(ideasRaw);
      for (const idea of entries) {
        if (!idea.id) {
          console.warn(`  skipping idea "${idea.title}" — no Id assigned, cannot migrate`);
          skippedIdeas++;
          continue;
        }
        const targetFile = join(ideasDir, `${idea.id}.md`);
        if (await exists(targetFile)) {
          skippedIdeas++;
          continue;
        }
        const body = idea.body.replace(/^#{1,3}\s+.+(?:\r?\n)?/, '').trim();
        const content = formatIdeaFile({ id: idea.id, title: idea.title, body });
        await writeFile(targetFile, `${content}\n`, 'utf-8');
        migratedIdeas++;
      }
    }

    const { entries: allPlans } = await readAllPlanFiles(plansDir);
    await writeFile(join(plansDir, 'index.md'), formatPlansIndex(allPlans), 'utf-8');
    const { entries: allIdeas } = await readAllIdeaFiles(ideasDir);
    const ideasWithStatus = deriveIdeaStatuses(allIdeas, allPlans);
    await writeFile(join(ideasDir, 'index.md'), formatIdeasIndex(ideasWithStatus), 'utf-8');

    // Empty, not a pointer comment: readPlansMerged/readIdeasMerged fast-path on falsy
    // monolithic content, and parseIdeas() in particular has no heading match for plain
    // prose, producing a phantom null-id entry that the merge step's dedup logic always
    // keeps. A truly empty file avoids both parsers entirely.
    if (migratedPlans > 0 && skippedPlans === 0 && planWarnings === 0) {
      await writeFile(plansPath, '', 'utf-8');
    }
    if (migratedIdeas > 0 && skippedIdeas === 0) {
      await writeFile(ideasPath, '', 'utf-8');
    }

    console.log(
      `Migrated ${migratedPlans} plans (${skippedPlans} skipped), ${migratedIdeas} ideas (${skippedIdeas} skipped).`,
    );
  });

program.parseAsync(process.argv);
