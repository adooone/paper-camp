import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GitManager } from '../app/server/git';
import {
  campFile,
  checkBranchConflictForPlan,
  planFileInput,
  readMaybe,
  regenerateIndexes,
  writePlanFile,
} from '../app/server/helpers';
import { parseDecisions, parseOpenQuestions, parsePlanFile } from '../core/parser';
import { readAllPlanFiles, readIdeasMerged, readPlansMerged } from '../core/readers';
import {
  appendBlock,
  archivePlanFile,
  assignPlanId,
  formatDecisionEntry,
  formatIdeaFile,
  formatOpenQuestions,
  formatPlanFile,
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
      description: 'List all plans (per-file and monolithic, merged), with parse warnings.',
      outputSchema: {
        entries: z.array(planEntrySchema),
        warnings: z.array(parseWarningSchema),
      },
    },
    async () => {
      const result = await readPlansMerged(campFile(root, 'plans'), campFile(root, 'plans.md'));
      return json({ ...result });
    },
  );

  server.registerTool(
    'get_plan',
    {
      title: 'Get plan',
      description: 'Fetch a single plan by its id (e.g. FEAT-32).',
      inputSchema: {
        id: z.string().describe('Plan id, e.g. FEAT-32'),
      },
      outputSchema: {
        entry: planEntrySchema.nullable(),
      },
    },
    async ({ id }) => {
      const { entries } = await readPlansMerged(
        campFile(root, 'plans'),
        campFile(root, 'plans.md'),
      );
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
 * call — never a raw file write — so id allocation, archive-on-done, and index
 * regeneration hold identically. `draft_plan` and `update_phase` also run the same
 * `checkBranchConflictForPlan` guard those routes enforce, so an MCP client can't
 * start or advance a plan a dashboard user would be blocked from.
 */
export function registerWriteTools(server: McpServer, root: string, git: GitManager): void {
  server.registerTool(
    'add_idea',
    {
      title: 'Add idea',
      description: 'Create a new per-file idea entry and regenerate the ideas index.',
      inputSchema: {
        title: z.string().describe('Idea title'),
        content: z.string().optional().describe('Idea body (markdown)'),
      },
      outputSchema: idResultSchema.shape,
    },
    async ({ title, content }) => {
      if (!title.trim()) throw new Error('title is required');
      const ideasDir = campFile(root, 'ideas');
      const existing = await readIdeasMerged(ideasDir, campFile(root, 'ideas.md'));
      const maxNum = existing.entries.reduce((max, idea) => {
        if (idea.id) {
          const num = Number.parseInt(idea.id.replace('IDEA-', ''), 10);
          return Number.isNaN(num) ? max : Math.max(max, num);
        }
        return max;
      }, 0);
      const newId = `IDEA-${maxNum + 1}`;
      await mkdir(ideasDir, { recursive: true });
      const ideaContent = formatIdeaFile({ id: newId, title: title.trim(), body: content?.trim() });
      await writeFile(join(ideasDir, `${newId}.md`), `${ideaContent}\n`, 'utf-8');
      await regenerateIndexes(root);
      return json({ ok: true, id: newId });
    },
  );

  server.registerTool(
    'draft_plan',
    {
      title: 'Draft plan',
      description: 'Create a new per-file plan entry, assigning it the next id for its kind.',
      inputSchema: {
        title: z.string().describe('Plan title'),
        content: z.string().optional().describe('Plan body (markdown)'),
        kind: z.enum(PLAN_KINDS).optional().describe("Plan kind, defaults to 'feat'"),
      },
      outputSchema: idResultSchema.shape,
    },
    async ({ title, content, kind }) => {
      if (!title.trim()) throw new Error('title is required');
      const conflict = await checkBranchConflictForPlan(root, git);
      if (conflict) throw new Error(conflict);
      const planKind = kind ?? 'feat';
      const configPath = join(root, 'papercamp', 'config.json');
      const id = await assignPlanId(configPath, planKind);
      if (!id) throw new Error('could not assign plan ID');

      const plansDir = campFile(root, 'plans');
      await mkdir(plansDir, { recursive: true });

      const planContent = formatPlanFile({
        id,
        title: title.trim(),
        kind: planKind,
        status: 'idea',
        created: todayDateString(),
        body: content?.trim(),
      });
      await writeFile(join(plansDir, `${id}.md`), `${planContent}\n`, 'utf-8');
      await regenerateIndexes(root);
      return json({ ok: true, id });
    },
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
      const plansDir = campFile(root, 'plans');
      const { entries } = await readAllPlanFiles(plansDir);
      const target = entries.find((e) => e.id === id);
      if (!target?.id) throw new Error(`plan "${id}" not found`);

      const conflict = await checkBranchConflictForPlan(root, git, target.id);
      if (conflict) throw new Error(conflict);

      const targetFile = join(plansDir, `${target.id}.md`);
      const raw = await readMaybe(targetFile);
      if (!raw) throw new Error('plan file not found');

      const parsed = parsePlanFile(raw);
      if (parsed.entries.length === 0) throw new Error('failed to parse plan file');
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

      await writePlanFile(
        targetFile,
        planFileInput(updatedEntry, { id: updatedEntry.id ?? target.id }),
      );
      await regenerateIndexes(root);

      if (status === 'done' || status === 'dropped') {
        await archivePlanFile(root, target.id);
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
