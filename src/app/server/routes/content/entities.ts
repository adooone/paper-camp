import {
  CorpusError,
  type CreateIdeaInput,
  type EntityFileInput,
  appendThread,
  createIdea,
  readCorpus,
  updateEntity,
} from '@/core/corpus';
import { computeNeedsBlockedIds, resolveNeedsRefs } from '@/core/needs';
import { readEntities } from '@/core/readers';
import { classifyRunOrderEntries, normalizeRunOrder } from '@/core/run-order';
import { agentThreadMessage } from '@/core/serialize';
import { promoteThreadMessage, replaceThreadKinds } from '@/core/thread';
import {
  AGENT_IDS,
  type AgentId,
  type EntityEntry,
  type EntityType,
  type LogEntry,
  type PhaseItem,
  type PlanStatus,
  type ThreadMessage,
} from '@/types/index';
import { campFile, readRunOrderFile, withRunOrderLock, writeRunOrderFile } from '../../helpers';
import { readBody, requestUrl, sendJson } from '../../http';
import type { Route, RouteContext } from '../types';

const NOTE_STATE_KINDS = new Set<ThreadMessage['kind']>(['note', 'decision', 'question']);

export function entityRoutes({ root, activity }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/entities',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const input = JSON.parse(reqBody) as Partial<CreateIdeaInput>;
        if (!input.title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
        const newId = await createIdea(root, { ...input, title: input.title.trim() });
        activity.notifyChanged();
        const unresolvedNeeds = input.needs
          ? (await resolveNeedsRefs(root, input.needs)).filter((r) => !r.found).map((r) => r.raw)
          : [];
        sendJson(res, 201, {
          ok: true,
          id: newId,
          ...(unresolvedNeeds.length > 0 && { unresolvedNeeds }),
        });
      },
    },

    {
      method: 'PATCH',
      path: '/api/entities',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id?.trim()) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        const reqBody = await readBody(req);
        const updates = JSON.parse(reqBody) as {
          title?: string;
          body?: string;
          tags?: string[];
          type?: EntityType;
          needs?: string[];
          phases?: PhaseItem[];
          fixes?: PhaseItem[];
          /** `null` clears the stored override (e.g. reopening a dropped plan). */
          status?: PlanStatus | null;
          log?: LogEntry[];
          thread?: ThreadMessage[];
          agent?: AgentId | null;
          subject?: string | null;
          order?: number | null;
        };
        if (updates.agent && !AGENT_IDS.includes(updates.agent)) {
          sendJson(res, 400, { error: 'agent must be a known agent id' });
          return;
        }

        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        // order is the one field notes can carry too — the up/down worklist
        // controls need to reorder a note against its plan/idea neighbours.
        const target = entries.find((e) => e.id === id.trim());

        if (!target) {
          sendJson(res, 404, { error: 'entity not found' });
          return;
        }

        // Run order lives in papercamp/run-order.md, not frontmatter (IDEA-98); notes
        // aren't part of that list, so their `order` still writes straight to frontmatter.
        let thread = target.thread;
        if (updates.thread !== undefined) {
          thread = updates.thread;
        }
        if (updates.log !== undefined) {
          thread = replaceThreadKinds(
            thread,
            ['log'],
            updates.log.map((e) => ({ kind: 'log' as const, date: e.date, text: e.text })),
          );
        }

        const buildOverrides = (entry: EntityEntry): Partial<EntityFileInput> => ({
          ...(updates.title !== undefined && { title: updates.title.trim() }),
          ...(updates.body !== undefined && { body: updates.body }),
          ...(updates.tags !== undefined && { tags: updates.tags }),
          ...(updates.type !== undefined && { type: updates.type }),
          ...(updates.needs !== undefined && { needs: updates.needs }),
          ...(updates.status !== undefined && { status: updates.status ?? undefined }),
          ...(updates.phases !== undefined && { phases: updates.phases }),
          ...(updates.fixes !== undefined && { fixes: updates.fixes }),
          ...(thread !== target.thread && { thread }),
          ...(updates.agent !== undefined && { agent: updates.agent ?? undefined }),
          ...(updates.subject !== undefined && { subject: updates.subject ?? undefined }),
          order:
            target.kind === 'note'
              ? updates.order !== undefined
                ? (updates.order ?? undefined)
                : (entry.storedOrder ?? entry.order)
              : undefined,
        });

        // Closing (done/dropped) is intentionally NOT branch-guarded: it isn't starting
        // new work, and approval typically happens after the branch is already merged.

        if (updates.status === 'in-progress') {
          for (const other of entries) {
            if (other.id !== target.id && other.kind !== 'note' && other.status === 'in-progress') {
              try {
                await updateEntity(root, other.id, () => ({ status: 'planned' }));
              } catch (error) {
                if (!(error instanceof CorpusError)) throw error;
              }
            }
          }
        }

        // A done/archived entity's own file is read-only (IDEA-187) — new phases or
        // fixes spawn their own linked fix entity instead of landing here.
        try {
          await updateEntity(root, target.id, buildOverrides);
        } catch (error) {
          if (error instanceof CorpusError) {
            sendJson(res, error.status, { error: error.message });
            return;
          }
          throw error;
        }

        // A status/order write can break the run-order invariant (contiguous 1..N over
        // planned/in-progress/review); reflow using DERIVED status, since overrides can lag.
        if (
          target.kind !== 'note' &&
          (updates.order !== undefined || updates.status !== undefined)
        ) {
          const moved =
            typeof updates.order === 'number' ? { id: target.id, order: updates.order } : undefined;
          const { work } = await readCorpus(root, { live: true });
          const updatedEntry = { ...target, ...buildOverrides(target) } as EntityEntry;
          const nextEntries = entries.map((e) => (e.id === target.id ? updatedEntry : e));
          const blockedIds = await computeNeedsBlockedIds(root, nextEntries);
          const classified = classifyRunOrderEntries(
            nextEntries.map((e) => ({ ...e, blockedByNeeds: blockedIds.has(e.id) })),
            work,
            (entryId) =>
              entryId === target.id && updates.status !== undefined
                ? { value: updates.status ?? undefined }
                : undefined,
          );
          await withRunOrderLock(async () => {
            const list = await readRunOrderFile(root);
            await writeRunOrderFile(root, normalizeRunOrder(list, classified, moved));
          });
        }

        activity.notifyChanged();
        const unresolvedNeeds = updates.needs
          ? (await resolveNeedsRefs(root, updates.needs)).filter((r) => !r.found).map((r) => r.raw)
          : [];
        sendJson(res, 200, { ok: true, ...(unresolvedNeeds.length > 0 && { unresolvedNeeds }) });
      },
    },

    {
      method: 'POST',
      path: '/api/entities/thread',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id?.trim()) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        const reqBody = await readBody(req);
        const { kind, text } = JSON.parse(reqBody) as {
          kind?: ThreadMessage['kind'];
          text?: string;
        };
        if (!kind || !text?.trim()) {
          sendJson(res, 400, { error: 'kind and text are required' });
          return;
        }
        const message = agentThreadMessage(text.trim(), kind);
        if (NOTE_STATE_KINDS.has(kind) && message.state === undefined) message.state = 'open';
        try {
          await appendThread(root, id.trim(), message);
        } catch (error) {
          if (error instanceof CorpusError) {
            sendJson(res, error.status, { error: error.message });
            return;
          }
          throw error;
        }
        activity.notifyChanged();
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/entities/thread/promote',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id?.trim()) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        const reqBody = await readBody(req);
        const { index, target, note } = JSON.parse(reqBody) as {
          index?: number;
          target?: 'decision' | 'log';
          note?: string;
        };
        if (typeof index !== 'number' || (target !== 'decision' && target !== 'log')) {
          sendJson(res, 400, { error: 'index and a decision/log target are required' });
          return;
        }
        try {
          await updateEntity(root, id.trim(), (entry) => {
            const thread = entry.thread ?? [];
            if (index < 0 || index >= thread.length) {
              throw new CorpusError(
                `thread index ${index} out of range (thread has ${thread.length} messages)`,
                400,
              );
            }
            return {
              thread: promoteThreadMessage(thread, index, target, note?.trim() || undefined),
            };
          });
        } catch (error) {
          if (error instanceof CorpusError) {
            sendJson(res, error.status, { error: error.message });
            return;
          }
          throw error;
        }
        activity.notifyChanged();
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/entities/archive',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id?.trim()) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        try {
          await updateEntity(root, id.trim(), (entry) => {
            if (entry.archived) throw new CorpusError(`entity "${id}" not found`, 404);
            return { status: 'dropped' };
          });
        } catch (error) {
          if (error instanceof CorpusError) {
            sendJson(res, error.status, { error: error.message });
            return;
          }
          throw error;
        }
        activity.notifyChanged();
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
