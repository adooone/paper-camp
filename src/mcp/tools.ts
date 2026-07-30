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
import { parseEntityFile } from '../core/parse';
import { entityToPlan, readEntities, readWorkEntries } from '../core/readers';
import {
  archiveEntityFile,
  assignEntityId,
  formatEntityFile,
  todayDateString,
} from '../core/serialize';
import { PLAN_KINDS, PLAN_STATUSES } from '../types/index';
import { idResultSchema, okResultSchema, parseWarningSchema, planEntrySchema } from './schemas';

function json(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

function fetchWorkEntries(root: string) {
  return readWorkEntries(campFile(root, 'ideas'));
}

// Wraps the same `src/core` readers/parsers as the dashboard's `/api/*` routes
// (src/app/server/routes/reads.ts), so MCP clients see identical data shapes.
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
      const result = await fetchWorkEntries(root);
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
      const { entries } = await fetchWorkEntries(root);
      const entry = entries.find((p) => p.id === id) ?? null;
      return json({ entry });
    },
  );
}

// Routes through the same core serializers and checkBranchConflictForPlan guard as the
// dashboard's route handlers, so an MCP client can't do what a dashboard user is blocked from.
export function registerWriteTools(server: McpServer, root: string, git: GitManager): void {
  // stdio can multiplex concurrent calls; without this, add_idea/draft_plan's
  // read-then-write id allocation could interleave and mint duplicate ids.
  let writeChain: Promise<unknown> = Promise.resolve();
  const runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = writeChain.then(fn, fn);
    writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  async function createIdeaEntity(input: {
    title: string;
    content?: string;
    type?: string;
  }): Promise<string> {
    const configPath = join(root, 'papercamp', 'config.json');
    const id = await assignEntityId(configPath);
    if (!id) throw new Error('could not assign entity ID');
    const ideasDir = campFile(root, 'ideas');
    await mkdir(ideasDir, { recursive: true });
    const content = formatEntityFile({
      id,
      title: input.title.trim(),
      type: input.type,
      status: 'idea',
      created: todayDateString(),
      body: input.content?.trim(),
    });
    await writeFile(join(ideasDir, `${id}.md`), `${content}\n`, 'utf-8');
    await regenerateIndexes(root);
    return id;
  }

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
        const id = await createIdeaEntity({ title, content });
        return json({ ok: true, id });
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
        const id = await createIdeaEntity({ title, content, type: kind ?? 'feat' });
        return json({ ok: true, id });
      }),
  );

  server.registerTool(
    'update_phase',
    {
      title: 'Update phase',
      description:
        'Toggle a plan phase done/not-done by index, optionally updating the plan status (archiving it only if the new status is dropped).',
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

      // `done` is derived from a merged PR and needs no archiving; `dropped` has no
      // such signal, so it's the one status that still archives on write.
      if (status === 'dropped') {
        await archiveEntityFile(root, target.id);
      }

      return json({ ok: true });
    },
  );
}
