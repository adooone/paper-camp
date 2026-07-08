import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GitManager } from '../app/server/git';
import {
  campFile,
  checkBranchConflictForPlan,
  entityFileInput,
  readMaybe,
  regenerateIndexes,
  writeEntityFile,
} from '../app/server/helpers';
import { parseDecisions, parseEntityFile, parseOpenQuestions } from '../core/parser';
import { entityToPlan, readEntities, readWorkEntries } from '../core/readers';
import {
  appendBlock,
  archiveEntityFile,
  assignEntityId,
  formatDecisionEntry,
  formatEntityFile,
  formatOpenQuestions,
  prependProgressItem,
  todayDateString,
} from '../core/serializer';
import { PLAN_KINDS, PLAN_STATUSES } from '../types/index';
import {
  decisionEntrySchema,
  idResultSchema,
  okResultSchema,
  openQuestionEntrySchema,
  parseWarningSchema,
  planEntrySchema,
} from './schemas';

function json(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

/**
 * Registers the v1 read tools, each a thin wrapper over the same `src/core`
 * readers/parsers the dashboard's `/api/*` routes call (`src/app/server/routes/reads.ts`),
 * so MCP clients see identical data shapes.
 */
export function registerReadTools(server: McpServer, root: string): void {
  server.registerTool(
    'list_plans',
    {
      title: 'List plans',
      description:
        'List all work entities (plan-shaped view of the unified corpus), with parse warnings.',
      outputSchema: {
        entries: z.array(planEntrySchema),
        warnings: z.array(parseWarningSchema),
      },
    },
    async () => {
      const result = await readWorkEntries(campFile(root, 'ideas'));
      return json({ ...result });
    },
  );

  server.registerTool(
    'get_plan',
    {
      title: 'Get plan',
      description: 'Fetch a single work entity by its id (e.g. IDEA-43).',
      inputSchema: {
        id: z.string().describe('Entity id, e.g. IDEA-43'),
      },
      outputSchema: {
        entry: planEntrySchema.nullable(),
      },
    },
    async ({ id }) => {
      const { entries } = await readWorkEntries(campFile(root, 'ideas'));
      const entry = entries.find((p) => p.id === id) ?? null;
      return json({ entry });
    },
  );

  server.registerTool(
    'list_open_questions',
    {
      title: 'List open questions',
      description: 'List all open questions with their status, with parse warnings.',
      outputSchema: {
        entries: z.array(openQuestionEntrySchema),
        warnings: z.array(parseWarningSchema),
      },
    },
    async () => {
      const result = parseOpenQuestions(await readMaybe(campFile(root, 'open-questions.md')));
      return json({ ...result });
    },
  );

  server.registerTool(
    'list_decisions',
    {
      title: 'List decisions',
      description: 'List all logged decisions, with parse warnings.',
      outputSchema: {
        entries: z.array(decisionEntrySchema),
        warnings: z.array(parseWarningSchema),
      },
    },
    async () => {
      const result = parseDecisions(await readMaybe(campFile(root, 'decisions.md')));
      return json({ ...result });
    },
  );
}

/**
 * Registers the v1 write tools, each routed through the same `src/core` serializers
 * the dashboard's route handlers (`src/app/server/routes/plans.ts`/`ideas.ts`/`docs.ts`)
 * call — never a raw file write — so id allocation, archive-on-drop, and index
 * regeneration hold identically. `draft_plan` and `update_phase` also run the same
 * `checkBranchConflictForPlan` guard those routes enforce, so an MCP client can't
 * start or advance a plan a dashboard user would be blocked from.
 */
export function registerWriteTools(server: McpServer, root: string, git: GitManager): void {
  // The stdio transport can multiplex concurrent tool calls, and the read-then-write
  // id allocation in add_idea / draft_plan would otherwise be able to interleave and
  // mint duplicate ids. A promise-chain mutex serializes id-allocating writes so each
  // sees the previous one's committed state.
  let writeChain: Promise<unknown> = Promise.resolve();
  const runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = writeChain.then(fn, fn);
    writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  server.registerTool(
    'add_idea',
    {
      title: 'Add idea',
      description: 'Create a new idea entity (status: idea) and regenerate the index.',
      inputSchema: {
        title: z.string().describe('Idea title'),
        content: z.string().optional().describe('Idea body (markdown)'),
      },
      outputSchema: idResultSchema.shape,
    },
    ({ title, content }) =>
      runExclusive(async () => {
        if (!title.trim()) throw new Error('title is required');
        const configPath = join(root, 'papercamp', 'config.json');
        const newId = await assignEntityId(configPath);
        if (!newId) throw new Error('could not assign entity ID');
        const ideasDir = campFile(root, 'ideas');
        await mkdir(ideasDir, { recursive: true });
        const ideaContent = formatEntityFile({
          id: newId,
          title: title.trim(),
          status: 'idea',
          created: todayDateString(),
          body: content?.trim(),
        });
        await writeFile(join(ideasDir, `${newId}.md`), `${ideaContent}\n`, 'utf-8');
        await regenerateIndexes(root);
        return json({ ok: true, id: newId });
      }),
  );

  server.registerTool(
    'draft_plan',
    {
      title: 'Draft plan',
      description:
        'Create a new typed work entity (status: idea) with the next lifetime IDEA-N id.',
      inputSchema: {
        title: z.string().describe('Entity title'),
        content: z.string().optional().describe('Entity body (markdown)'),
        kind: z.enum(PLAN_KINDS).optional().describe("Work type, defaults to 'feat'"),
      },
      outputSchema: idResultSchema.shape,
    },
    ({ title, content, kind }) =>
      runExclusive(async () => {
        if (!title.trim()) throw new Error('title is required');
        const conflict = await checkBranchConflictForPlan(root, git);
        if (conflict) throw new Error(conflict);
        const planKind = kind ?? 'feat';
        const configPath = join(root, 'papercamp', 'config.json');
        const id = await assignEntityId(configPath);
        if (!id) throw new Error('could not assign entity ID');

        const ideasDir = campFile(root, 'ideas');
        await mkdir(ideasDir, { recursive: true });

        const planContent = formatEntityFile({
          id,
          title: title.trim(),
          type: planKind,
          status: 'idea',
          created: todayDateString(),
          body: content?.trim(),
        });
        await writeFile(join(ideasDir, `${id}.md`), `${planContent}\n`, 'utf-8');
        await regenerateIndexes(root);
        return json({ ok: true, id });
      }),
  );

  server.registerTool(
    'update_phase',
    {
      title: 'Update phase',
      description:
        'Toggle a plan phase done/not-done by index, optionally updating the plan status (archiving it if the new status is done or dropped).',
      inputSchema: {
        id: z.string().describe('Plan id, e.g. FEAT-32'),
        phaseIndex: z.number().int().nonnegative().describe('0-based index into the phases list'),
        done: z.boolean(),
        status: z.enum(PLAN_STATUSES).optional().describe('Optional new plan status'),
      },
      outputSchema: okResultSchema.shape,
    },
    async ({ id, phaseIndex, done, status }) => {
      const ideasDir = campFile(root, 'ideas');
      const { entries } = await readEntities(ideasDir);
      const target = entries.find((e) => e.id === id && e.kind !== 'note');
      if (!target) throw new Error(`plan "${id}" not found`);

      const conflict = await checkBranchConflictForPlan(root, git, target.id);
      if (conflict) throw new Error(conflict);

      const targetFile = join(ideasDir, `${target.id}.md`);
      const raw = await readMaybe(targetFile);
      if (!raw) throw new Error('entity file not found');

      const parsed = parseEntityFile(raw);
      if (parsed.entries.length === 0) throw new Error('failed to parse entity file');
      const entry = parsed.entries[0];

      if (phaseIndex < 0 || phaseIndex >= entry.phases.length) {
        throw new Error(
          `phase index ${phaseIndex} out of range (plan has ${entry.phases.length} phases)`,
        );
      }

      const phases = entry.phases.map((phase, i) =>
        i === phaseIndex ? { ...phase, done } : phase,
      );
      const updatedEntry = {
        ...entry,
        phases,
        ...(status !== undefined && { status }),
        updated: todayDateString(),
      };

      await writeEntityFile(targetFile, entityFileInput(updatedEntry));
      await regenerateIndexes(root);

      // `done` is derived from a merged PR, so it never needs archiving on its own —
      // moving the file would just be a needless commit. `dropped` has no such signal,
      // so it stays the one status that still archives on write.
      if (status === 'dropped') {
        await archiveEntityFile(root, target.id);
      }

      return json({ ok: true });
    },
  );

  server.registerTool(
    'append_progress',
    {
      title: 'Append progress',
      description: "Prepend a bullet under today's heading in progress.md.",
      inputSchema: {
        item: z.string().describe('Progress bullet text (without the leading "- ")'),
      },
      outputSchema: okResultSchema.shape,
    },
    async ({ item }) => {
      if (!item.trim()) throw new Error('item is required');
      await prependProgressItem(campFile(root, 'progress.md'), item.trim());
      return json({ ok: true });
    },
  );

  server.registerTool(
    'resolve_open_question',
    {
      title: 'Resolve open question',
      description: 'Resolve an open question, logging the resolution as a new decision.',
      inputSchema: {
        title: z.string().describe('Open question title'),
        decision: z.string().describe('The decision that resolves it'),
        rationale: z.string().optional().describe('Rationale to log alongside the decision'),
      },
      outputSchema: okResultSchema.shape,
    },
    async ({ title, decision, rationale }) => {
      if (!decision.trim()) throw new Error('decision is required');

      const questionsPath = campFile(root, 'open-questions.md');
      const raw = await readMaybe(questionsPath);
      if (!raw) throw new Error('open-questions.md not found');
      const parsed = parseOpenQuestions(raw);
      if (parsed.warnings.length > 0) {
        throw new Error(
          `open-questions.md has parse warnings — resolve them before updating to avoid data loss: ${parsed.warnings
            .map((w) => `${w.title}: ${w.message}`)
            .join('; ')}`,
        );
      }
      const trimmed = title.trim();
      const target = parsed.entries.find((q) => q.title === trimmed);
      if (!target) throw new Error(`open question "${trimmed}" not found`);
      if (target.status !== 'open') {
        throw new Error(`open question "${trimmed}" is already ${target.status}`);
      }

      const decisionBlock = formatDecisionEntry({
        title: decision.trim(),
        date: todayDateString(),
        status: 'decided',
        body: rationale?.trim(),
      });
      await appendBlock(campFile(root, 'decisions.md'), decisionBlock);

      target.status = 'resolved';
      target.resolvedBy = decision.trim();
      const updated = formatOpenQuestions(parsed.entries);
      await writeFile(questionsPath, `${updated}\n`, 'utf-8');

      return json({ ok: true });
    },
  );
}
