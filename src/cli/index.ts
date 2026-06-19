#!/usr/bin/env node
import { basename, resolve } from 'node:path';
import { Command } from 'commander';
import { AlreadyInitializedError, PAPER_CAMP_VERSION, initProject } from '../core/scaffold';
import { appendBlock, formatPlanEntry, todayDateString } from '../core/serializer';
import { startDevServer } from './dev-server';

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
      console.log('  .paper-camp/config.json');
      console.log('  papercamp/ideas.md, plans.md, progress.md, decisions.md, open-questions.md');
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
  .action(async (type: string, name: string | undefined) => {
    if (type !== 'plan') {
      console.error(`Unknown type "${type}". Supported types: plan`);
      process.exitCode = 1;
      return;
    }
    if (!name) {
      console.error('Usage: paper-camp add plan <name>');
      process.exitCode = 1;
      return;
    }

    const filePath = resolve(process.cwd(), 'papercamp', 'plans.md');
    const block = formatPlanEntry({ title: name, status: 'idea', created: todayDateString() });
    await appendBlock(filePath, block);
    console.log(`Added plan "${name}" to papercamp/plans.md`);
  });

program.parseAsync(process.argv);
