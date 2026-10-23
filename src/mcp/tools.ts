import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveDaemonTarget } from '../core/daemon-target';
import {
  PLAN_KINDS,
  PLAN_STATUSES,
  type PlanEntry,
  type ResolvedRoadmap,
  type SuggestionEntry,
  type ThreadMessage,
} from '../types/index';
import { idResultSchema, okResultSchema, parseWarningSchema, planEntrySchema } from './schemas';

export const NO_DAEMON_ERROR =
  'run `paper-camp start` and register this repo with `paper-camp init`';

function json(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

/** A tool-scoped HTTP client against this repo's daemon-mounted project, resolved
 * fresh per call — the daemon may not have been running at MCP server startup. */
interface DaemonClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
}

async function daemonClient(root: string): Promise<DaemonClient> {
  const target = await resolveDaemonTarget(root);
  if (!target) throw new Error(NO_DAEMON_ERROR);
  const base = `${target.origin}/p/${target.slug}`;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      method,
      ...(body !== undefined && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      throw new Error(
        (data as { error?: string } | undefined)?.error ?? `request failed: ${response.status}`,
      );
    }
    return data as T;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
  };
}

// Every tool is a thin HTTP client against the daemon's `/api/*` routes — the same
// routes the dashboard uses — so writes, archiving and the `changed` tick happen in one place.
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
      const client = await daemonClient(root);
      const result = await client.get<{ entries: PlanEntry[]; warnings: unknown[] }>('/api/plans');
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
      const client = await daemonClient(root);
      const { entries } = await client.get<{ entries: PlanEntry[] }>('/api/plans');
      const entry = entries.find((p) => p.id === id) ?? null;
      return json({ entry });
    },
  );
}

export function registerWriteTools(server: McpServer, root: string): void {
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
    async ({ title, content, needs }) => {
      if (!title.trim()) throw new Error('title is required');
      const client = await daemonClient(root);
      const result = await client.post<{ ok: true; id: string; unresolvedNeeds?: string[] }>(
        '/api/entities',
        { title: title.trim(), content, needs },
      );
      return json(result);
    },
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
    async ({ title, content, kind }) => {
      if (!title.trim()) throw new Error('title is required');
      const client = await daemonClient(root);
      const result = await client.post<{ ok: true; id: string }>('/api/entities', {
        title: title.trim(),
        content,
        type: kind ?? 'feat',
      });
      return json(result);
    },
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
      const client = await daemonClient(root);
      await client.patch(`/api/entities?id=${encodeURIComponent(id)}`, {
        phase: { index: phaseIndex, done },
        ...(status !== undefined && { status }),
      });
      return json({ ok: true });
    },
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
    async ({ id, title, content, tags, type, needs }) => {
      if (title !== undefined && !title.trim()) throw new Error('title cannot be empty');
      const client = await daemonClient(root);
      const result = await client.patch<{ ok: true; unresolvedNeeds?: string[] }>(
        `/api/entities?id=${encodeURIComponent(id)}`,
        {
          ...(title !== undefined && { title: title.trim() }),
          ...(content !== undefined && { body: content.trim() }),
          ...(tags !== undefined && { tags }),
          ...(type !== undefined && { type }),
          ...(needs !== undefined && { needs }),
        },
      );
      return json(result);
    },
  );

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
      async ({ id, text }) => {
        if (!text.trim()) throw new Error('text is required');
        const client = await daemonClient(root);
        await client.post(`/api/entities/thread?id=${encodeURIComponent(id)}`, {
          kind,
          text: text.trim(),
        });
        return json({ ok: true });
      },
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
    async ({ title, date }) => {
      const client = await daemonClient(root);
      const { entries } = await client.get<{ entries: SuggestionEntry[] }>('/api/suggestions');
      const suggestion = entries.find(
        (s) => s.title === title.trim() && (date === undefined || s.date === date),
      );
      if (!suggestion) throw new Error(`suggestion "${title}" not found`);
      const result = await client.post<{ ok: true; id: string }>('/api/suggestions/promote', {
        suggestion,
      });
      return json(result);
    },
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
    async ({ horizonTitle, itemName, candidateName, subject }) => {
      const client = await daemonClient(root);
      const roadmap = await client.get<ResolvedRoadmap | null>('/api/roadmap');
      const item = roadmap?.horizons
        .find((h) => h.title === horizonTitle)
        ?.items.find((it) => it.name === itemName);
      if (!item || (candidateName !== undefined && !item.candidates.includes(candidateName))) {
        throw new Error('roadmap item or candidate not found');
      }
      const result = await client.post<{ ok: true; id: string }>('/api/roadmap/promote', {
        horizonTitle,
        item,
        subject,
        candidateName,
      });
      return json(result);
    },
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
    async ({ id, index, target, note }) => {
      const client = await daemonClient(root);
      await client.post(`/api/entities/thread/promote?id=${encodeURIComponent(id)}`, {
        index,
        target,
        note,
      });
      return json({ ok: true });
    },
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
    async ({ id }) => {
      const client = await daemonClient(root);
      await client.post(`/api/entities/archive?id=${encodeURIComponent(id)}`);
      return json({ ok: true });
    },
  );
}
