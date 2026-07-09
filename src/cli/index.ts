#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { buildConvergenceAuditPrompt } from '../app/features/plans/prompts';
import { type AgentAdapter, resolveAgent } from '../app/server/agents/index';
import { computePlanContentHash } from '../core/content-hash';
import { parseEntityFile, parseIdeaFile, parsePlanFile } from '../core/parser';
import { entityToPlan, readEntitiesWithDerivedStatus } from '../core/readers';
import { AlreadyInitializedError, PAPER_CAMP_VERSION, initProject } from '../core/scaffold';
import {
  assignEntityId,
  formatEntitiesIndex,
  formatEntityFile,
  todayDateString,
} from '../core/serializer';
import { startMcpServer } from '../mcp/server';
import {
  type AgentRunOptions,
  DEFAULT_AGENTS,
  type LogEntry,
  PLAN_KINDS,
  type PlanEntry,
  coerceAgentConfig,
} from '../types/index';
import { startDevServer } from './dev-server';
import { logNewFile } from './post-tool-use-log';
import { buildSessionFocus } from './session-focus';

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findPlanFile(plansDir: string, id: string): Promise<string | null> {
  const direct = join(plansDir, `${id}.md`);
  if (await exists(direct)) return direct;
  const archived = join(plansDir, 'archive', `${id}.md`);
  if (await exists(archived)) return archived;
  return null;
}

async function stampCliAuditDate(planFile: string, planId: string): Promise<void> {
  // Throw on failure so the caller can mark the audit failed rather than
  // logging [done] while the audited stamp was silently never written.
  const raw = await readFile(planFile, 'utf-8');
  const parsed = parseEntityFile(raw);
  const entry = parsed.entries[0];
  if (!entry) {
    throw new Error(`Could not parse entity file after audit: ${planFile}`);
  }
  const writeInput: Parameters<typeof formatEntityFile>[0] = {
    id: planId,
    title: entry.title,
    type: entry.type,
    kind: entry.kind,
    status: entry.status,
    agent: entry.agent,
    created: entry.created,
    updated: entry.updated,
    audited: todayDateString(),
    auditedHash: computePlanContentHash({ body: entry.body, phases: entry.phases }),
    tags: entry.tags,
    body: entry.body,
    phases: entry.phases,
    log: entry.log,
    clarifications: entry.clarifications,
  };
  await writeFile(planFile, `${formatEntityFile(writeInput)}\n`, 'utf-8');
}

async function runPlanAudit(
  root: string,
  plan: PlanEntry,
  adapter: AgentAdapter,
  opts?: AgentRunOptions,
): Promise<boolean> {
  const prompt = buildConvergenceAuditPrompt(plan);
  const proc = spawn(adapter.command, adapter.buildArgs(prompt, opts), {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (proc.stdout) {
    const rl = createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      const parsed = adapter.parseLine(line);
      if (parsed?.text && parsed.text !== 'Agent is working…') {
        process.stdout.write(`    ${parsed.text}\n`);
      }
    });
  }
  proc.stderr?.on('data', (d: Buffer) => process.stderr.write(d));

  return new Promise((resolve) => {
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
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
      console.log('  papercamp/ideas/          (one file per idea, plan as a section)');
      console.log('  papercamp/ideas/index.md');
      console.log('  papercamp/ideas/archive/');
      console.log('  papercamp/progress.md, decisions.md, open-questions.md');
      console.log('  .claude/skills/paper-camp/SKILL.md');
      console.log('  .claude/settings.json     (SessionStart + PostToolUse hooks)');
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
      // Hard-exit: the API middleware's fs watchers are already running by the time
      // listen fails, and they keep the event loop alive forever with exitCode alone.
      process.exit(1);
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
    const id = await assignEntityId(configPath);

    if (!id) {
      console.error('Could not assign entity ID — is the project initialized?');
      process.exitCode = 1;
      return;
    }

    const ideasDir = resolve(root, 'papercamp', 'ideas');
    await mkdir(ideasDir, { recursive: true });

    const entityContent = formatEntityFile({
      id,
      title: name,
      type: kind,
      status: 'idea',
      created: todayDateString(),
    });
    await writeFile(join(ideasDir, `${id}.md`), `${entityContent}\n`, 'utf-8');

    // Regenerate the unified index
    const { entries } = await readEntitiesWithDerivedStatus(ideasDir);
    await writeFile(join(ideasDir, 'index.md'), formatEntitiesIndex(entries), 'utf-8');

    console.log(`Added "${name}" (${id}) to papercamp/ideas/${id}.md`);
  });

program
  .command('migrate')
  .description(
    'One-time migration: merge the two-file plans/ideas corpus into unified single-file entities under papercamp/ideas/',
  )
  .action(async () => {
    const root = process.cwd();
    const plansDir = resolve(root, 'papercamp', 'plans');
    const ideasDir = resolve(root, 'papercamp', 'ideas');
    const entityArchiveDir = join(ideasDir, 'archive');
    await mkdir(entityArchiveDir, { recursive: true });

    const stripHeading = (body: string) => body.replace(/^#{1,3}\s+[^\n]*\n?/, '').trim();
    const isClosed = (status: string | undefined) => status === 'done' || status === 'dropped';
    const numOf = (id: string) => Number.parseInt(id.replace(/^[A-Z]+-/, ''), 10);

    async function readLegacyDir<T>(
      dir: string,
      parse: (content: string) => { entries: T[]; warnings: { title: string; message: string }[] },
    ): Promise<T[]> {
      const out: T[] = [];
      const files: string[] = await readdir(dir).catch(() => []);
      for (const f of files.filter((f) => f.endsWith('.md') && f !== 'index.md')) {
        const { entries, warnings } = parse(await readFile(join(dir, f), 'utf-8'));
        for (const w of warnings) console.warn(`  warning: ${f}: ${w.message}`);
        out.push(...entries);
      }
      return out;
    }

    // Legacy ideas live flat in ideas/; legacy plans in plans/ + plans/archive/.
    const legacyIdeas = (
      await readLegacyDir(ideasDir, (c) => {
        const r = parseIdeaFile(c);
        return { entries: r.entries, warnings: r.warnings };
      })
    ).filter((i) => i.id);
    const legacyPlans = [
      ...(await readLegacyDir(plansDir, parsePlanFile)),
      ...(await readLegacyDir(join(plansDir, 'archive'), parsePlanFile)),
    ].filter((p) => p.id);

    if (legacyPlans.length === 0) {
      console.log('Nothing to migrate — no legacy plan files under papercamp/plans/.');
      return;
    }

    const plansByIdea = new Map<string, typeof legacyPlans>();
    for (const p of legacyPlans) {
      if (!p.idea) continue;
      if (!plansByIdea.has(p.idea)) plansByIdea.set(p.idea, []);
      plansByIdea.get(p.idea)?.push(p);
    }
    const configPath = resolve(root, 'papercamp', 'config.json');

    const mergedLog = (idea: { log?: LogEntry[] } | undefined, plan: { log?: LogEntry[] }) =>
      [...(idea?.log ?? []), ...(plan.log ?? [])].sort((a, b) => a.date.localeCompare(b.date));

    let written = 0;
    const writeEntity = async (input: Parameters<typeof formatEntityFile>[0]) => {
      const target = join(isClosed(input.status) ? entityArchiveDir : ideasDir, `${input.id}.md`);
      await writeFile(target, `${formatEntityFile(input)}\n`, 'utf-8');
      written++;
    };

    // Ideas: merge with their plan(s), or pass through as planless entities.
    for (const idea of legacyIdeas) {
      const ideaId = idea.id as string;
      const plans = (plansByIdea.get(ideaId) ?? []).sort(
        (a, b) => numOf(a.id as string) - numOf(b.id as string),
      );
      if (plans.length === 0) {
        await writeEntity({
          id: ideaId,
          title: idea.title,
          kind: idea.kind === 'note' ? 'note' : undefined,
          status: idea.kind === 'note' ? (idea.status ?? 'open') : 'idea',
          created: todayDateString(),
          body: stripHeading(idea.body),
          log: idea.log,
        });
        continue;
      }
      // First plan keeps the idea's id; splits from a multi-plan idea mint fresh ids.
      for (const [i, plan] of plans.entries()) {
        const id = i === 0 ? ideaId : await assignEntityId(configPath);
        if (!id) throw new Error('could not mint an entity id — is nextId.idea configured?');
        await writeEntity({
          id,
          title: plan.title,
          type: plan.kind,
          status: plan.status,
          agent: plan.agent,
          created: plan.created,
          updated: plan.updated,
          audited: plan.audited,
          auditedHash: plan.auditedHash,
          tags: plan.tags,
          body: [stripHeading(idea.body), plan.body].filter(Boolean).join('\n\n'),
          phases: plan.phases,
          log: mergedLog(i === 0 ? idea : undefined, plan),
          clarifications: plan.clarifications,
        });
      }
    }

    // Orphan plans (no idea backlink): mint fresh lifetime ids in chronological order.
    const orphans = legacyPlans
      .filter((p) => !p.idea)
      .sort(
        (a, b) =>
          a.created.localeCompare(b.created) || numOf(a.id as string) - numOf(b.id as string),
      );
    for (const plan of orphans) {
      const id = await assignEntityId(configPath);
      if (!id) throw new Error('could not mint an entity id — is nextId.idea configured?');
      await writeEntity({
        id,
        title: plan.title,
        type: plan.kind,
        status: plan.status,
        agent: plan.agent,
        created: plan.created,
        updated: plan.updated,
        audited: plan.audited,
        auditedHash: plan.auditedHash,
        tags: plan.tags,
        body: plan.body,
        phases: plan.phases,
        log: plan.log,
        clarifications: plan.clarifications,
      });
    }

    const { entries } = await readEntitiesWithDerivedStatus(ideasDir);
    await writeFile(join(ideasDir, 'index.md'), formatEntitiesIndex(entries), 'utf-8');

    console.log(
      `Migrated ${written} entities into papercamp/ideas/ (${orphans.length} orphan plans minted fresh ids).`,
    );
    console.log(
      'Verify the result, then delete papercamp/plans/ — it is no longer read. Consider simplifying archived bodies by hand or with an agent; git history keeps the originals.',
    );
  });

program
  .command('audit')
  .description('Audit all review/done plans for missing phases')
  .action(async () => {
    const root = process.cwd();
    const ideasDir = resolve(root, 'papercamp', 'ideas');

    const { entries: allEntities, warnings } = await readEntitiesWithDerivedStatus(ideasDir);

    for (const warning of warnings) {
      console.warn(`  warning: ${warning.title}: ${warning.message}`);
    }

    const candidates = allEntities
      .filter((e) => e.kind !== 'note' && (e.status === 'review' || e.status === 'done'))
      .map((e) => entityToPlan(e));

    if (candidates.length === 0) {
      console.log('No plans with status "review" or "done" found.');
      return;
    }

    const configRaw = await readFile(join(root, 'papercamp', 'config.json'), 'utf-8').catch(
      () => '{}',
    );
    let config: {
      defaultAgents?: Record<string, unknown>;
      defaultAgent?: string;
    };
    try {
      config = JSON.parse(configRaw) as typeof config;
    } catch {
      console.error('Invalid papercamp/config.json');
      process.exitCode = 1;
      return;
    }
    const rawAgents = config.defaultAgents;
    const defaultAgents = rawAgents
      ? {
          phase: coerceAgentConfig(rawAgents.phase),
          planDraft: coerceAgentConfig(rawAgents.planDraft),
          ideaExtend: coerceAgentConfig(rawAgents.ideaExtend),
          commitSuggest: coerceAgentConfig(rawAgents.commitSuggest),
        }
      : DEFAULT_AGENTS;
    const { adapter, model, effort } = resolveAgent({ defaultAgents, taskKind: 'audit' });

    console.log(`Auditing ${candidates.length} plan(s):\n`);

    interface AuditResult {
      id: string;
      title: string;
      status: 'audited' | 'skipped' | 'failed';
      gapPhases?: number;
      skipReason?: string;
    }

    const results: AuditResult[] = [];

    for (const plan of candidates) {
      const id = plan.id ?? '(no id)';
      const label = id.padEnd(14);

      if (!plan.id) {
        console.log(`  [skip]  ${label} ${plan.title} — no id`);
        results.push({ id, title: plan.title, status: 'skipped', skipReason: 'no id' });
        continue;
      }

      const planFile = await findPlanFile(ideasDir, plan.id);
      if (!planFile) {
        console.log(`  [skip]  ${label} ${plan.title} — file not found`);
        results.push({ id, title: plan.title, status: 'skipped', skipReason: 'file not found' });
        continue;
      }

      if (plan.audited && plan.auditedHash) {
        const contentHash = computePlanContentHash({ body: plan.body, phases: plan.phases });
        if (contentHash === plan.auditedHash) {
          console.log(
            `  [skip]  ${label} ${plan.title} — audited ${plan.audited}, unchanged since`,
          );
          results.push({
            id,
            title: plan.title,
            status: 'skipped',
            skipReason: `audited ${plan.audited}, unchanged`,
          });
          continue;
        }
      }

      const phasesBefore = plan.phases.length;

      console.log(`  [audit] ${label} ${plan.title}`);
      const success = await runPlanAudit(root, plan, adapter, { model, effort });

      if (success) {
        try {
          await stampCliAuditDate(planFile, plan.id);
        } catch (err) {
          console.log(`  [fail]  ${label} ${plan.title} — ${(err as Error).message}`);
          process.exitCode = 1;
          results.push({ id, title: plan.title, status: 'failed' });
          continue;
        }

        const afterRaw = await readFile(planFile, 'utf-8').catch(() => '');
        const afterParsed = parsePlanFile(afterRaw);
        const phasesAfter = afterParsed.entries[0]?.phases.length ?? phasesBefore;
        const gapPhases = Math.max(0, phasesAfter - phasesBefore);

        console.log(`  [done]  ${label} ${plan.title}`);
        results.push({ id, title: plan.title, status: 'audited', gapPhases });
      } else {
        console.log(`  [fail]  ${label} ${plan.title} — agent exited with error`);
        process.exitCode = 1;
        results.push({ id, title: plan.title, status: 'failed' });
      }
    }

    const audited = results.filter((r) => r.status === 'audited');
    const skipped = results.filter((r) => r.status === 'skipped');
    const failed = results.filter((r) => r.status === 'failed');
    const totalGaps = audited.reduce((sum, r) => sum + (r.gapPhases ?? 0), 0);
    const bar = '─'.repeat(43);

    console.log(`\n${bar}`);
    console.log('Audit summary');
    console.log(
      `  Audited : ${audited.length}   Skipped : ${skipped.length}   Failed : ${failed.length}`,
    );
    if (audited.length > 0) {
      if (totalGaps > 0) {
        console.log(`  Gap phases appended: ${totalGaps} total`);
        for (const r of audited.filter((r) => (r.gapPhases ?? 0) > 0)) {
          console.log(`    ${r.id.padEnd(14)} +${r.gapPhases} phase(s)`);
        }
      } else {
        console.log('  No gap phases appended — all audited plans are complete.');
      }
    }
    if (skipped.length > 0) {
      console.log('  Skipped:');
      for (const r of skipped) {
        console.log(`    ${r.id.padEnd(14)} ${r.skipReason}`);
      }
    }
    console.log(bar);
  });

program
  .command('mcp')
  .description('Run the Paper Camp MCP server (stdio) for the current project')
  .action(async () => {
    try {
      await startMcpServer(process.cwd());
    } catch (error) {
      console.error(`Failed to start MCP server: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// The two commands below are internal — invoked by the scaffolded
// `.claude/settings.json` hooks, not by users.
program
  .command('session-focus')
  .description(
    'Print a SessionStart focus block for the current project (used by Claude Code hooks)',
  )
  .action(async () => {
    const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const context = await buildSessionFocus(root).catch(() => null);
    if (!context) return;
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: context,
        },
      }),
    );
  });

program
  .command('post-tool-use-log')
  .description('Log a new file created by a Write tool call (used by Claude Code hooks)')
  .action(async () => {
    const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf-8');
    // A malformed/truncated stdin payload makes JSON.parse throw synchronously —
    // this opt-in hook must stay a silent no-op rather than surface an unhandled
    // rejection, matching the .catch(() => undefined) around logNewFile below.
    let input: unknown = {};
    try {
      input = raw ? JSON.parse(raw) : {};
    } catch {
      return;
    }
    await logNewFile(root, input as never).catch(() => undefined);
  });

program.parseAsync(process.argv);
