import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GitManager } from '../app/server/git';
import { campFile, readMaybe } from '../app/server/helpers';
import { CorpusError, appendThread, createIdea, readCorpus, updateEntity } from '../core/corpus';
import { resolveNeedsRefs } from '../core/needs';
import { parseSuggestions } from '../core/parse';
import { linkRoadmapItem, parseRoadmap, removeRoadmapItem } from '../core/roadmap';
import { agentThreadMessage, removeSuggestionLine } from '../core/serialize';
import { promoteThreadMessage } from '../core/thread';
import { PLAN_KINDS, PLAN_STATUSES, type ThreadMessage } from '../types/index';
import { idResultSchema, okResultSchema, parseWarningSchema, planEntrySchema } from './schemas';

function json(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

async function fetchWorkEntries(root: string) {
  const { work, warnings, resolved } = await readCorpus(root, { live: true });
  return { entries: work, warnings, resolved };
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

  // Serialised, not branch-gated: which branch you are on no longer decides what you
  // may work on, so this only keeps concurrent writes from interleaving.
  const guardedWrite = <T>(_targetPlanId: string | undefined, fn: () => Promise<T>): Promise<T> =>
    runExclusive(fn);

  server.registerTool(
    'add_idea',
    {
      title: 'Add idea',
      description: 'Create a new idea entity (status: idea) and regenerate the index.',
      inputSchema: {
        title: z.string().describe('Idea title'),
        content: z.string().optional().describe('Idea body (markdown)'),
        needs: z
          .array(z.string())
          .optional()
          .describe(
            'Entities this one waits on: IDEA-N for this project, <slug>/IDEA-N for another project on the same machine',
          ),
      },
      outputSchema: idResultSchema.shape,
    },
    ({ title, content, needs }) =>
      guardedWrite(undefined, async () => {
        if (!title.trim()) throw new Error('title is required');
        const id = await createIdea(root, { title, content, needs });
        const unresolvedNeeds = (await resolveNeedsRefs(root, needs ?? []))
          .filter((r) => !r.found)
          .map((r) => r.raw);
        return json({
          ok: true,
          id,
          ...(unresolvedNeeds.length > 0 && { unresolvedNeeds }),
        });
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
      guardedWrite(undefined, async () => {
        if (!title.trim()) throw new Error('title is required');
        const id = await createIdea(root, { title, content, type: kind ?? 'feat' });
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
    ({ id, phaseIndex, done, status }) =>
      guardedWrite(id, async () => {
        try {
          await updateEntity(root, id, (entry) => {
            if (phaseIndex < 0 || phaseIndex >= entry.phases.length) {
              throw new Error(
                `phase index ${phaseIndex} out of range (plan has ${entry.phases.length} phases)`,
              );
            }
            return {
              phases: entry.phases.map((phase, i) =>
                i === phaseIndex ? { ...phase, done } : phase,
              ),
              ...(status !== undefined && { status }),
            };
          });
        } catch (error) {
          if (error instanceof CorpusError) throw new Error(error.message);
          throw error;
        }
        return json({ ok: true });
      }),
  );

  server.registerTool(
    'edit_idea',
    {
      title: 'Edit idea',
      description:
        'Edit an existing entity in place — any of title, body, tags, type, or needs. Omitted fields are left untouched.',
      inputSchema: {
        id: z.string().describe('Entity id, e.g. IDEA-43'),
        title: z.string().optional().describe('New title'),
        content: z.string().optional().describe('New body (markdown), replacing the current body'),
        tags: z.array(z.string()).optional().describe('New tag list, replacing the current tags'),
        type: z.enum(PLAN_KINDS).optional().describe('New work type'),
        needs: z
          .array(z.string())
          .optional()
          .describe(
            'New needs list, replacing the current one: IDEA-N for this project, <slug>/IDEA-N for another project on the same machine',
          ),
      },
      outputSchema: okResultSchema.shape,
    },
    ({ id, title, content, tags, type, needs }) =>
      guardedWrite(id, async () => {
        if (title !== undefined && !title.trim()) throw new Error('title cannot be empty');
        try {
          await updateEntity(root, id, () => ({
            ...(title !== undefined && { title: title.trim() }),
            ...(content !== undefined && { body: content.trim() }),
            ...(tags !== undefined && { tags }),
            ...(type !== undefined && { type }),
            ...(needs !== undefined && { needs }),
          }));
        } catch (error) {
          if (error instanceof CorpusError) throw new Error(error.message);
          throw error;
        }

        const unresolvedNeeds = needs
          ? (await resolveNeedsRefs(root, needs)).filter((r) => !r.found).map((r) => r.raw)
          : [];
        return json({ ok: true, ...(unresolvedNeeds.length > 0 && { unresolvedNeeds }) });
      }),
  );

  const NOTE_STATE_KINDS = new Set<ThreadMessage['kind']>(['note', 'decision', 'question']);

  async function appendThreadMessage(
    id: string,
    kind: ThreadMessage['kind'],
    text: string,
  ): Promise<void> {
    if (!text.trim()) throw new Error('text is required');
    const message = agentThreadMessage(text.trim(), kind);
    if (NOTE_STATE_KINDS.has(kind) && message.state === undefined) message.state = 'open';
    try {
      await appendThread(root, id, message);
    } catch (error) {
      if (error instanceof CorpusError) throw new Error(error.message);
      throw error;
    }
  }

  function registerAppendTool(
    name: string,
    title: string,
    description: string,
    kind: ThreadMessage['kind'],
  ): void {
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema: {
          id: z.string().describe('Entity id, e.g. IDEA-43'),
          text: z.string().describe('Message text (markdown)'),
        },
        outputSchema: okResultSchema.shape,
      },
      ({ id, text }) =>
        guardedWrite(id, async () => {
          await appendThreadMessage(id, kind, text);
          return json({ ok: true });
        }),
    );
  }

  registerAppendTool(
    'append_log',
    'Append log line',
    "Append a dated log line to an entity's thread.",
    'log',
  );
  registerAppendTool(
    'append_clarification',
    'Append clarification',
    "Append a clarification to an entity's thread.",
    'clarification',
  );
  registerAppendTool(
    'append_decision',
    'Append decision',
    "Append an open decision note to an entity's thread.",
    'decision',
  );
  registerAppendTool(
    'append_note',
    'Append thread note',
    "Append an open note to an entity's thread.",
    'note',
  );

  server.registerTool(
    'promote_suggestion',
    {
      title: 'Promote suggestion',
      description: 'Mint an idea from a suggestion line in suggestions.md and remove that line.',
      inputSchema: {
        title: z.string().describe('Suggestion title, matched against suggestions.md'),
        date: z
          .string()
          .optional()
          .describe('Suggestion date (YYYY-MM-DD), to disambiguate a repeated title'),
      },
      outputSchema: idResultSchema.shape,
    },
    ({ title, date }) =>
      guardedWrite(undefined, async () => {
        const suggestionsPath = campFile(root, 'suggestions.md');
        const raw = await readMaybe(suggestionsPath);
        const suggestion = parseSuggestions(raw).find(
          (s) => s.title === title.trim() && (date === undefined || s.date === date),
        );
        if (!suggestion) throw new Error(`suggestion "${title}" not found`);
        const id = await createIdea(root, {
          title: suggestion.title,
          content: suggestion.description,
        });
        await writeFile(suggestionsPath, removeSuggestionLine(raw, suggestion), 'utf-8');
        return json({ ok: true, id });
      }),
  );

  server.registerTool(
    'promote_roadmap_item',
    {
      title: 'Promote roadmap item',
      description:
        'Mint an idea from a roadmap item (or one of its candidates) in ROADMAP.md, linking it back to the item.',
      inputSchema: {
        horizonTitle: z.string().describe('Horizon heading the item lives under'),
        itemName: z.string().describe('Roadmap item name'),
        candidateName: z
          .string()
          .optional()
          .describe('Candidate bullet to promote; omit to promote the item itself'),
        subject: z.string().optional().describe('Subject override for the new idea'),
      },
      outputSchema: idResultSchema.shape,
    },
    ({ horizonTitle, itemName, candidateName, subject }) =>
      guardedWrite(undefined, async () => {
        const roadmapPath = join(root, 'ROADMAP.md');
        const raw = await readMaybe(roadmapPath);
        if (!raw) throw new Error('ROADMAP.md not found');
        const item = parseRoadmap(raw)
          .horizons.find((h) => h.title === horizonTitle)
          ?.items.find((it) => it.name === itemName);
        if (!item || (candidateName !== undefined && !item.candidates.includes(candidateName))) {
          throw new Error('roadmap item or candidate not found');
        }
        const id = await createIdea(root, {
          title: candidateName ?? item.name,
          subject: subject?.trim() || (candidateName ? item.name : undefined),
          content: candidateName
            ? `From the roadmap: ${horizonTitle} — ${item.name}.`
            : `${item.description}\n\nFrom the roadmap: ${horizonTitle}.`,
        });
        const withoutCandidate = candidateName
          ? removeRoadmapItem(raw, horizonTitle, item.name, candidateName)
          : raw;
        await writeFile(
          roadmapPath,
          linkRoadmapItem(withoutCandidate, horizonTitle, item.name, id),
          'utf-8',
        );
        return json({ ok: true, id });
      }),
  );

  server.registerTool(
    'promote_thread_message',
    {
      title: 'Promote thread message',
      description:
        'Distill one thread message in place into a durable decision or log entry, optionally appending a breadcrumb note.',
      inputSchema: {
        id: z.string().describe('Entity id, e.g. IDEA-43'),
        index: z.number().int().nonnegative().describe('0-based index into the entity thread'),
        target: z.enum(['decision', 'log']).describe('Durable kind to distill the message into'),
        note: z.string().optional().describe('Breadcrumb appended to the message text'),
      },
      outputSchema: okResultSchema.shape,
    },
    ({ id, index, target, note }) =>
      guardedWrite(id, async () => {
        try {
          await updateEntity(root, id, (entry) => {
            const thread = entry.thread ?? [];
            if (index < 0 || index >= thread.length) {
              throw new Error(
                `thread index ${index} out of range (thread has ${thread.length} messages)`,
              );
            }
            return {
              thread: promoteThreadMessage(thread, index, target, note?.trim() || undefined),
            };
          });
        } catch (error) {
          if (error instanceof CorpusError) throw new Error(error.message);
          throw error;
        }
        return json({ ok: true });
      }),
  );

  server.registerTool(
    'archive_entity',
    {
      title: 'Archive entity',
      description: 'Drop an entity: set its status to dropped and move its file into the archive.',
      inputSchema: {
        id: z.string().describe('Entity id, e.g. IDEA-43'),
      },
      outputSchema: okResultSchema.shape,
    },
    ({ id }) =>
      guardedWrite(id, async () => {
        try {
          await updateEntity(root, id, (entry) => {
            if (entry.archived) throw new Error(`entity "${id}" not found`);
            return { status: 'dropped' };
          });
        } catch (error) {
          if (error instanceof CorpusError) throw new Error(error.message);
          throw error;
        }
        return json({ ok: true });
      }),
  );
}
