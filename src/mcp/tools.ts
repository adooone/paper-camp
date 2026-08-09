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
import { parseEntityFile, parseSuggestions } from '../core/parse';
import { entityToPlan, readEntities, readWorkEntries } from '../core/readers';
import { linkRoadmapItem, parseRoadmap, removeRoadmapItem } from '../core/roadmap';
import {
  agentThreadMessage,
  archiveEntityFile,
  assignEntityId,
  formatEntityFile,
  removeSuggestionLine,
  todayDateString,
} from '../core/serialize';
import { promoteThreadMessage } from '../core/thread';
import { PLAN_KINDS, PLAN_STATUSES, type ThreadMessage } from '../types/index';
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

  const guardedWrite = <T>(targetPlanId: string | undefined, fn: () => Promise<T>): Promise<T> =>
    runExclusive(async () => {
      const conflict = await checkBranchConflictForPlan(root, git, targetPlanId);
      if (conflict) throw new Error(conflict);
      return fn();
    });

  async function createIdeaEntity(input: {
    title: string;
    content?: string;
    type?: string;
    subject?: string;
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
      subject: input.subject,
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
      guardedWrite(undefined, async () => {
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
      guardedWrite(undefined, async () => {
        if (!title.trim()) throw new Error('title is required');
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
    ({ id, phaseIndex, done, status }) =>
      guardedWrite(id, async () => {
        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        const target = entries.find((e) => e.id === id && e.kind !== 'note');
        if (!target) throw new Error(`plan "${id}" not found`);

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

        // `done` is derived from a merged PR and needs no archiving; `dropped` has no
        // such signal, so it's the one status that still archives on write.
        if (status === 'dropped') {
          await archiveEntityFile(root, target.id);
        }
        await regenerateIndexes(root);

        return json({ ok: true });
      }),
  );

  server.registerTool(
    'edit_idea',
    {
      title: 'Edit idea',
      description:
        'Edit an existing entity in place — any of title, body, tags, or type. Omitted fields are left untouched.',
      inputSchema: {
        id: z.string().describe('Entity id, e.g. IDEA-43'),
        title: z.string().optional().describe('New title'),
        content: z.string().optional().describe('New body (markdown), replacing the current body'),
        tags: z.array(z.string()).optional().describe('New tag list, replacing the current tags'),
        type: z.enum(PLAN_KINDS).optional().describe('New work type'),
      },
      outputSchema: okResultSchema.shape,
    },
    ({ id, title, content, tags, type }) =>
      guardedWrite(id, async () => {
        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        const target = entries.find((e) => e.id === id && e.kind !== 'note');
        if (!target) throw new Error(`entity "${id}" not found`);

        const targetFile = join(ideasDir, `${target.id}.md`);
        const raw = await readMaybe(targetFile);
        if (!raw) throw new Error('entity file not found');

        const parsed = parseEntityFile(raw);
        if (parsed.entries.length === 0) throw new Error('failed to parse entity file');
        const entry = parsed.entries[0];

        const overrides: Partial<ReturnType<typeof entityFileInput>> = {};
        if (title !== undefined) {
          if (!title.trim()) throw new Error('title cannot be empty');
          overrides.title = title.trim();
        }
        if (content !== undefined) overrides.body = content.trim();
        if (tags !== undefined) overrides.tags = tags;
        if (type !== undefined) overrides.type = type;

        const updatedEntry = { ...entry, updated: todayDateString() };
        await writeEntityFile(targetFile, entityFileInput(updatedEntry, overrides));
        await regenerateIndexes(root);

        return json({ ok: true });
      }),
  );

  const NOTE_STATE_KINDS = new Set<ThreadMessage['kind']>(['note', 'decision', 'question']);

  async function appendThreadMessage(
    id: string,
    kind: ThreadMessage['kind'],
    text: string,
  ): Promise<void> {
    if (!text.trim()) throw new Error('text is required');
    const ideasDir = campFile(root, 'ideas');
    const { entries } = await readEntities(ideasDir);
    const target = entries.find((e) => e.id === id);
    if (!target) throw new Error(`entity "${id}" not found`);

    const targetFile = join(ideasDir, `${target.id}.md`);
    const raw = await readMaybe(targetFile);
    if (!raw) throw new Error('entity file not found');

    const parsed = parseEntityFile(raw);
    if (parsed.entries.length === 0) throw new Error('failed to parse entity file');
    const entry = parsed.entries[0];

    const message = agentThreadMessage(text.trim(), kind);
    if (NOTE_STATE_KINDS.has(kind) && message.state === undefined) message.state = 'open';
    const thread = [...(entry.thread ?? []), message];

    await writeEntityFile(
      targetFile,
      entityFileInput({ ...entry, thread, updated: todayDateString() }),
    );
    await regenerateIndexes(root);
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
        const id = await createIdeaEntity({
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
        const id = await createIdeaEntity({
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
        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        const targetEntity = entries.find((e) => e.id === id);
        if (!targetEntity) throw new Error(`entity "${id}" not found`);

        const targetFile = join(ideasDir, `${targetEntity.id}.md`);
        const raw = await readMaybe(targetFile);
        if (!raw) throw new Error('entity file not found');

        const parsed = parseEntityFile(raw);
        if (parsed.entries.length === 0) throw new Error('failed to parse entity file');
        const entry = parsed.entries[0];

        const thread = entry.thread ?? [];
        if (index < 0 || index >= thread.length) {
          throw new Error(
            `thread index ${index} out of range (thread has ${thread.length} messages)`,
          );
        }

        await writeEntityFile(
          targetFile,
          entityFileInput(entry, {
            thread: promoteThreadMessage(thread, index, target, note?.trim() || undefined),
            updated: todayDateString(),
          }),
        );
        await regenerateIndexes(root);
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
        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        const target = entries.find((e) => e.id === id && !e.archived);
        if (!target) throw new Error(`entity "${id}" not found`);

        const targetFile = join(ideasDir, `${target.id}.md`);
        const raw = await readMaybe(targetFile);
        if (!raw) throw new Error('entity file not found');

        const parsed = parseEntityFile(raw);
        if (parsed.entries.length === 0) throw new Error('failed to parse entity file');
        const entry = parsed.entries[0];

        await writeEntityFile(
          targetFile,
          entityFileInput(entry, { status: 'dropped', updated: todayDateString() }),
        );
        await archiveEntityFile(root, target.id);
        await regenerateIndexes(root);
        return json({ ok: true });
      }),
  );
}
