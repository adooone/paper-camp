#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { buildConvergenceAuditPrompt } from '../app/features/plans/prompts';
import { type AgentAdapter, resolveAgent } from '../app/server/agents/index';
import { entityFileInput, writeEntityFile } from '../app/server/helpers';
import { bumpCorpusFormat } from '../core/corpus-format';
import {
  collectDoctorContext,
  planDoctorFixes,
  reportFindings,
  runDoctorChecks,
} from '../core/doctor';
import {
  resolvePlanForPrRef,
  syncConsistencyCommentToPr,
  syncPlanPhasesToPr,
  syncPrLabelsToPr,
  syncPrReadinessToPr,
  syncPrTitleToPr,
  validatePrTitle,
} from '../core/git-pr';
import {
  type MachineProject,
  addProject,
  defaultRegistryPath,
  loadRegistry,
  removeProject,
  saveRegistry,
  scanForProjects,
} from '../core/machine-registry';
import { parseEntityFile, parseIdeaFile, parsePlanFile } from '../core/parse';
import { entityToPlan, readEntitiesWithDerivedStatus } from '../core/readers';
import { formatReleaseNotesMarkdown, resolveReleaseNotes } from '../core/release-notes';
import { AlreadyInitializedError, PAPER_CAMP_VERSION, initProject } from '../core/scaffold';
import { computePlanContentHash } from '../core/serialize';
import { assignEntityId, formatEntityFile, todayDateString } from '../core/serialize';
import { threadFromLegacy } from '../core/thread';
import { resolveIdeasForRelease, resolveReleaseRanges } from '../core/trail';
import { startMcpServer } from '../mcp/server';
import {
  type AgentRunOptions,
  DEFAULT_AGENTS,
  type LogEntry,
  PLAN_KINDS,
  type PlanEntry,
  coerceAgentConfig,
} from '../types/index';
import {
  DEFAULT_LOG_LINES,
  runLogs,
  runLs,
  runRestart,
  runStart,
  runStatus,
  runStop,
} from './daemon-lifecycle';
import { DEFAULT_DAEMON_PORT, startDaemonServer } from './daemon-server';
import { readConfigPort, resolveDevPort } from './dev-port';
import { startDevServer } from './dev-server';
import { buildSessionFocus } from './session-focus';

function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

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
    released: entry.released,
    tags: entry.tags,
    body: entry.body,
    phases: entry.phases,
    thread: entry.thread,
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
  .action(async (projectName: string | undefined) => {
    const targetDir = process.cwd();
    const name = projectName ?? basename(targetDir);
    try {
      await initProject(targetDir, { projectName: name });
      console.log(`Initialized Paper Camp in ${targetDir}`);
      console.log('  papercamp/config.json');
      console.log('  papercamp/ideas/          (one file per idea, plan as a section)');
      console.log('  papercamp/ideas/archive/');
      console.log('  .claude/skills/paper-camp/SKILL.md');
      console.log('  .claude/settings.json     (SessionStart hook)');
    } catch (error) {
      if (error instanceof AlreadyInitializedError) {
        fail(error.message);
        return;
      }
      throw error;
    }
  });

program
  .command('dev')
  .description('Start the local dashboard')
  .option(
    '-p, --port <number>',
    'port to listen on (default: papercamp/config.json port, else 3333)',
  )
  .option(
    '--share',
    'open an account-less cloudflared quick tunnel so the hosted client can reach this machine from anywhere',
  )
  .option(
    '--tailnet',
    "serve over HTTPS at this machine's stable MagicDNS address via `tailscale serve`",
  )
  .action(async (opts: { port?: string; share?: boolean; tailnet?: boolean }) => {
    const root = process.cwd();
    const configPort = opts.port ? undefined : await readConfigPort(root);
    const port = resolveDevPort(opts.port, configPort);
    try {
      await startDevServer({ root, port, share: opts.share, tailnet: opts.tailnet });
    } catch (error) {
      console.error((error as Error).message);
      // Hard-exit: the API middleware's fs watchers are already running by the time
      // listen fails, and they keep the event loop alive forever with exitCode alone.
      process.exit(1);
    }
  });

program
  .command('daemon')
  .description(
    'Serve every registered project from one process, mounted at /p/<slug>/ on first request',
  )
  .option('-p, --port <number>', `port to listen on (default: ${DEFAULT_DAEMON_PORT})`)
  .option(
    '--share',
    'open an account-less cloudflared quick tunnel so the hosted client can reach this machine from anywhere',
  )
  .option(
    '--tailnet',
    "serve over HTTPS at this machine's stable MagicDNS address via `tailscale serve`",
  )
  .action(async (opts: { port?: string; share?: boolean; tailnet?: boolean }) => {
    const port = opts.port ? Number(opts.port) : DEFAULT_DAEMON_PORT;
    try {
      await startDaemonServer({ port, share: opts.share, tailnet: opts.tailnet });
    } catch (error) {
      console.error((error as Error).message);
      // Hard-exit: a mounted project's fs watchers may already be running by the
      // time listen fails, and they keep the event loop alive forever otherwise.
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start `paper-camp daemon` detached, logging to daemon.log in the config dir')
  .option('-p, --port <number>', `port to listen on (default: ${DEFAULT_DAEMON_PORT})`)
  .option(
    '--share',
    'open an account-less cloudflared quick tunnel so the hosted client can reach this machine from anywhere',
  )
  .option(
    '--tailnet',
    "serve over HTTPS at this machine's stable MagicDNS address via `tailscale serve`",
  )
  .action(async (opts: { port?: string; share?: boolean; tailnet?: boolean }) => {
    const ok = await runStart({
      port: opts.port ? Number(opts.port) : undefined,
      share: opts.share,
      tailnet: opts.tailnet,
    });
    if (!ok) process.exitCode = 1;
  });

program
  .command('stop')
  .description('Stop the running daemon (SIGTERM, then SIGKILL after five seconds)')
  .action(async () => {
    if (!(await runStop())) process.exitCode = 1;
  });

program
  .command('restart')
  .description('Stop the running daemon and start it again with the same flags')
  .action(async () => {
    if (!(await runRestart())) process.exitCode = 1;
  });

program
  .command('status')
  .description("Show whether the daemon is running and each registered project's STATE")
  .action(async () => {
    await runStatus();
  });

program
  .command('ls')
  .description('List projects registered in the machine-level registry, with each STATE')
  .action(async () => {
    await runLs();
  });

program
  .command('logs')
  .description(`Print daemon.log (last ${DEFAULT_LOG_LINES} lines by default)`)
  .option('-n, --lines <number>', `number of lines to print (default: ${DEFAULT_LOG_LINES})`)
  .option('-f, --follow', 'follow the log until interrupted')
  .action(async (opts: { lines?: string; follow?: boolean }) => {
    await runLogs({
      lines: opts.lines ? Number(opts.lines) : undefined,
      follow: opts.follow,
    });
  });

program
  .command('rm <slug>')
  .description('Remove a project from the machine-level registry')
  .action(async (slug: string) => {
    const path = defaultRegistryPath();
    const registry = await loadRegistry(path);
    const result = removeProject(registry, slug);
    if (!result.removed) {
      fail(`No registered project with slug "${slug}"`);
      return;
    }
    await saveRegistry(path, result.registry);
    console.log(`Removed "${slug}" from the registry.`);
  });

program
  .command('scan <dir>')
  .description(
    'Register every folder one level deep under <dir> that contains papercamp/config.json',
  )
  .action(async (dir: string) => {
    const entries = await scanForProjects(dir).catch((error: NodeJS.ErrnoException) => {
      fail(`Could not scan "${dir}": ${error.message}`);
      return null;
    });
    if (!entries) return;

    const path = defaultRegistryPath();
    let registry = await loadRegistry(path);
    const added: MachineProject[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const entry of entries) {
      if (!entry.hasConfig) {
        skipped.push({ name: entry.name, reason: 'no papercamp/config.json' });
        continue;
      }
      const result = addProject(registry, entry.path, entry.name);
      registry = result.registry;
      if (result.created) {
        added.push(result.entry);
      } else {
        skipped.push({ name: entry.name, reason: `already registered as "${result.entry.slug}"` });
      }
    }

    if (added.length === 0 && skipped.length === 0) {
      console.log(`No subdirectories found under ${resolve(dir)}.`);
      return;
    }

    if (added.length > 0) {
      await saveRegistry(path, registry);
      console.log('Added:');
      const slugWidth = Math.max(...added.map((p) => p.slug.length));
      for (const project of added) {
        console.log(`  ${project.slug.padEnd(slugWidth)}  ${project.path}`);
      }
    }

    if (skipped.length > 0) {
      console.log('Skipped:');
      for (const s of skipped) {
        console.log(`  ${s.name} — ${s.reason}`);
      }
    }
  });

program
  .command('add <type> [name]')
  .description('Add a new entry (currently supports: plan)')
  .option('-k, --kind <kind>', `plan kind (${PLAN_KINDS.join('|')})`, 'feat')
  .action(async (type: string, name: string | undefined, opts: { kind: string }) => {
    if (type !== 'plan') {
      fail(`Unknown type "${type}". Supported types: plan`);
      return;
    }
    if (!name) {
      fail('Usage: paper-camp add plan <name> [--kind feat|fix|chore|docs|refactor]');
      return;
    }
    if (!PLAN_KINDS.includes(opts.kind as (typeof PLAN_KINDS)[number])) {
      fail(`Unknown kind "${opts.kind}". Supported kinds: ${PLAN_KINDS.join(', ')}`);
      return;
    }

    const kind = opts.kind;
    const root = process.cwd();
    const configPath = resolve(root, 'papercamp', 'config.json');
    const id = await assignEntityId(configPath);

    if (!id) {
      fail('Could not assign entity ID — is the project initialized?');
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

    const mergedThread = (idea: { log?: LogEntry[] } | undefined, plan: PlanEntry) =>
      threadFromLegacy(
        [...(idea?.log ?? []), ...(plan.log ?? [])],
        plan.clarifications,
        plan.notes,
        plan.review,
      );

    let written = 0;
    const writeEntity = async (input: Parameters<typeof formatEntityFile>[0]) => {
      const target = join(isClosed(input.status) ? entityArchiveDir : ideasDir, `${input.id}.md`);
      await writeFile(target, `${formatEntityFile(input)}\n`, 'utf-8');
      written++;
    };

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
          thread: threadFromLegacy(idea.log),
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
          thread: mergedThread(i === 0 ? idea : undefined, plan),
        });
      }
    }

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
        thread: threadFromLegacy(plan.log, plan.clarifications, plan.notes, plan.review),
      });
    }

    console.log(
      `Migrated ${written} entities into papercamp/ideas/ (${orphans.length} orphan plans minted fresh ids).`,
    );
    console.log(
      'Verify the result, then delete papercamp/plans/ — it is no longer read. Consider simplifying archived bodies by hand or with an agent; git history keeps the originals.',
    );
  });

export async function runAudit(root: string): Promise<boolean> {
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
    return true;
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
    return false;
  }
  const rawAgents = config.defaultAgents;
  const defaultAgents = rawAgents
    ? {
        phase: coerceAgentConfig(rawAgents.phase),
        planDraft: coerceAgentConfig(rawAgents.planDraft),
        ideaExtend: coerceAgentConfig(rawAgents.ideaExtend),
        commitSuggest: coerceAgentConfig(rawAgents.commitSuggest),
        feedback: rawAgents.feedback
          ? coerceAgentConfig(rawAgents.feedback)
          : DEFAULT_AGENTS.feedback,
        codeReview: rawAgents.codeReview
          ? coerceAgentConfig(rawAgents.codeReview)
          : DEFAULT_AGENTS.codeReview,
        deskDiscovery: rawAgents.deskDiscovery
          ? coerceAgentConfig(rawAgents.deskDiscovery)
          : DEFAULT_AGENTS.deskDiscovery,
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
  let ok = true;

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
        console.log(`  [skip]  ${label} ${plan.title} — audited ${plan.audited}, unchanged since`);
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
        ok = false;
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
      ok = false;
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

  return ok;
}

program
  .command('audit')
  .description('Audit all review/done plans for missing phases')
  .action(async () => {
    const ok = await runAudit(process.cwd());
    if (!ok) process.exitCode = 1;
  });

program
  .command('doctor')
  .description(
    'Validate corpus structure — frontmatter schema, id/counter, phases-list integrity, archive placement, dangling links',
  )
  .option(
    '--fix',
    'apply the automatic fixes doctor knows how to migrate (currently: archive placement)',
  )
  .option(
    '--bump-format',
    'stamp papercamp/config.json with the corpus format version this paper-camp writes, for review as a git diff before committing',
  )
  .action(async (opts: { fix?: boolean; bumpFormat?: boolean }) => {
    const root = process.cwd();
    const paperCampDir = resolve(root, 'papercamp');

    if (opts.bumpFormat) {
      const bump = await bumpCorpusFormat(join(paperCampDir, 'config.json'));
      if (!bump) {
        console.log('papercamp/config.json is already at the current corpus format version.');
        return;
      }
      console.log(
        `Bumped corpus format version ${bump.from ?? '(unstamped)'} -> ${bump.to} in papercamp/config.json. Review with \`git diff\` before committing.`,
      );
      return;
    }

    const context = await collectDoctorContext(paperCampDir);
    const findings = runDoctorChecks(context);

    if (!opts.fix) {
      const report = reportFindings(findings);
      console.log(report.text);
      if (report.errorCount > 0) process.exitCode = 1;
      return;
    }

    const plan = planDoctorFixes(context, findings);
    for (const action of plan.actions) {
      if (action.kind === 'move') {
        await mkdir(dirname(join(root, action.to)), { recursive: true });
        await rename(join(root, action.from), join(root, action.to));
        console.log(`  [moved]  ${action.from} -> ${action.to}`);
      } else {
        await writeFile(join(root, action.path), action.content, 'utf-8');
        console.log(`  [fixed]  ${action.path}`);
      }
    }

    const manual = [...plan.unfixable, ...plan.rejected];
    const remaining = reportFindings(manual);
    console.log(remaining.text);
    console.log(
      `Applied ${plan.actions.length} fix(es); ${manual.length} finding(s) need manual attention.`,
    );
    if (plan.rejected.length > 0) {
      console.log(
        `Refused ${plan.rejected.length} move(s): destination already exists — resolve the duplicate by hand.`,
      );
      process.exitCode = 1;
    }
    if (remaining.errorCount > 0) process.exitCode = 1;
  });

export async function runStampRelease(root: string, version: string): Promise<boolean> {
  const ideasDir = resolve(root, 'papercamp', 'ideas');

  const changelog = await readFile(join(root, 'CHANGELOG.md'), 'utf-8').catch(() => '');
  const release = resolveReleaseRanges(changelog).find((r) => r.version === version);
  if (!release) {
    console.error(`No release range for "${version}" found in CHANGELOG.md`);
    return false;
  }

  const ideas = await resolveIdeasForRelease(root, release.range);
  if (ideas.size === 0) {
    console.log(`No ideas resolved for ${version} (${release.range}).`);
    return true;
  }

  let stamped = 0;
  for (const id of ideas.keys()) {
    const planFile = await findPlanFile(ideasDir, id);
    if (!planFile) {
      console.log(`  [skip]     ${id} — file not found`);
      continue;
    }
    const entry = parseEntityFile(await readFile(planFile, 'utf-8')).entries[0];
    if (!entry) {
      console.log(`  [skip]     ${id} — could not parse`);
      continue;
    }
    if (entry.status === 'dropped') {
      console.log(`  [skip]     ${id} — dropped`);
      continue;
    }
    if (entry.released) {
      console.log(`  [skip]     ${id} — already stamped ${entry.released}`);
      continue;
    }
    await writeEntityFile(root, planFile, entityFileInput(entry, { released: version }));
    console.log(`  [stamped]  ${id} -> ${version}`);
    stamped++;
  }
  console.log(`Stamped ${stamped} of ${ideas.size} idea(s) with released: ${version}`);
  return true;
}

program
  .command('stamp-release <version>')
  .description(
    'Stamp released: <version> onto every idea that version shipped — resolves the commit ' +
      'range from the CHANGELOG compare link, then joins each commit to an idea via trailers/branch names',
  )
  .action(async (version: string) => {
    const ok = await runStampRelease(process.cwd(), version);
    if (!ok) process.exitCode = 1;
  });

export async function runReleaseNotes(root: string, version: string): Promise<boolean> {
  const sections = await resolveReleaseNotes(root, version);
  if (!sections) {
    console.error(`No release range for "${version}" found in CHANGELOG.md`);
    return false;
  }
  console.log(formatReleaseNotesMarkdown(version, sections));
  return true;
}

program
  .command('release-notes <version>')
  .description(
    'Print release notes for <version> grouped by idea instead of by raw commit — one row per ' +
      'idea (its title, not the commit subject), sectioned the same as the CHANGELOG',
  )
  .action(async (version: string) => {
    const ok = await runReleaseNotes(process.cwd(), version);
    if (!ok) process.exitCode = 1;
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

program
  .command('resolve-pr <ref>')
  .description(
    'Resolve the plan a PR (number or branch) mirrors and print its kind/tags/phases as JSON (used by the Scout CI workflows)',
  )
  .action(async (ref: string) => {
    const root = process.cwd();
    const resolved = await resolvePlanForPrRef(root, ref);
    if (!resolved) {
      fail(`Could not resolve a plan for "${ref}"`);
      return;
    }
    console.log(JSON.stringify(resolved, null, 2));
  });

function registerPrSyncCommand(
  name: string,
  description: string,
  syncFn: (root: string, ref: string) => Promise<string | 'unresolved'>,
  failVerb: string,
): void {
  program
    .command(`${name} <ref>`)
    .description(description)
    .action(async (ref: string) => {
      const root = process.cwd();
      const result = await syncFn(root, ref);
      if (result === 'unresolved') {
        fail(`Could not ${failVerb} for "${ref}"`);
        return;
      }
      console.log(result);
    });
}

registerPrSyncCommand(
  'sync-pr-phases',
  "Rewrite a PR's (number or branch) body to render its plan's phases as a task list, preserving the Plan line (used by the Scout CI workflows)",
  syncPlanPhasesToPr,
  'sync plan phases to a PR',
);

registerPrSyncCommand(
  'sync-pr-labels',
  "Apply labels derived from a plan's kind/tags to its PR (number or branch), creating missing labels as needed (used by the Scout CI workflows)",
  syncPrLabelsToPr,
  'sync plan labels to a PR',
);

registerPrSyncCommand(
  'sync-pr-title',
  'Retitle a PR (number or branch) to `<type>(<scope>): <Idea title> (IDEA-N)` from its plan (used by the Scout CI workflows)',
  syncPrTitleToPr,
  'sync PR title',
);

program
  .command('validate-pr-title <ref>')
  .description(
    "Fail if a PR's (number or branch) title is not a conventional-commit title — the squash-merge commit inherits it verbatim (used by the Scout CI workflows)",
  )
  .action(async (ref: string) => {
    const root = process.cwd();
    const result = await validatePrTitle(root, ref);
    if (result === 'invalid') {
      fail(`PR title is not a conventional commit (expected "type(scope): ..."): "${ref}"`);
      return;
    }
    console.log(result);
  });

registerPrSyncCommand(
  'sync-pr-readiness',
  "Flip a PR (number or branch) to ready for review once its plan's phases are all checked, or close it when the plan is dropped (used by the Scout CI workflows)",
  syncPrReadinessToPr,
  'sync PR readiness',
);

registerPrSyncCommand(
  'sync-pr-consistency',
  "Upsert a sticky Scout comment on a PR (number or branch) with findConsistencyIssues' results and the plan's convergence-audit staleness (used by the Scout CI workflows)",
  syncConsistencyCommentToPr,
  'sync consistency checks to a PR',
);

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

// import.meta.url is realpath-resolved but argv[1] isn't, so under pnpm's symlinked
// node_modules this guard was false on every install — the CLI ran, matched nothing, and exited 0.
function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(resolve(process.argv[1]));
  } catch {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
  }
}

if (isMainModule()) {
  program.parseAsync(process.argv);
}
