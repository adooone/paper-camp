import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDecisions, parseOpenQuestions } from '@/core/parse';
import { readEntities } from '@/core/readers';
import {
  appendBlock,
  formatDecisionEntry,
  formatDecisions,
  formatOpenQuestionEntry,
  formatOpenQuestions,
  todayDateString,
} from '@/core/serialize';
import type { LogEntry } from '@/types/index';
import { campFile, entityFileInput, fileExists, readMaybe, writeEntityFile } from '../../helpers';
import { readBody, requestUrl, sendJson } from '../../http';
import type { Route, RouteContext } from '../types';

export function docsRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/open-questions/resolve',
      handle: async (req, res) => {
        const title = requestUrl(req).searchParams.get('title');
        if (!title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
        const body = await readBody(req);
        const { decision, rationale } = JSON.parse(body) as {
          decision?: string;
          rationale?: string;
        };
        if (!decision?.trim()) {
          sendJson(res, 400, { error: 'decision is required' });
          return;
        }

        // Validate everything before any writes — avoids partial state on failure.
        const questionsPath = campFile(root, 'open-questions.md');
        const raw = await readMaybe(questionsPath);
        if (!raw) {
          sendJson(res, 404, { error: 'open-questions.md not found' });
          return;
        }
        const parsed = parseOpenQuestions(raw);
        if (parsed.warnings.length > 0) {
          sendJson(res, 409, {
            error:
              'open-questions.md has parse warnings — resolve them before updating to avoid data loss',
            warnings: parsed.warnings.map((w) => `${w.title}: ${w.message}`),
          });
          return;
        }
        const trimmed = title.trim();
        const target = parsed.entries.find((q) => q.title === trimmed);
        if (!target) {
          sendJson(res, 404, { error: `open question "${trimmed}" not found` });
          return;
        }
        if (target.status !== 'open') {
          sendJson(res, 409, { error: `open question "${trimmed}" is already ${target.status}` });
          return;
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

        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/decisions/supersede',
      handle: async (req, res) => {
        const body = await readBody(req);
        const { title, newTitle, rationale } = JSON.parse(body) as {
          title?: string;
          newTitle?: string;
          rationale?: string;
        };
        if (!title?.trim() || !newTitle?.trim()) {
          sendJson(res, 400, { error: 'title and newTitle are required' });
          return;
        }

        const decisionsPath = campFile(root, 'decisions.md');
        const raw = await readMaybe(decisionsPath);
        if (!raw) {
          sendJson(res, 404, { error: 'decisions.md not found' });
          return;
        }
        const parsed = parseDecisions(raw);
        if (parsed.warnings.length > 0) {
          sendJson(res, 409, {
            error:
              'decisions.md has parse warnings — resolve them before updating to avoid data loss',
            warnings: parsed.warnings.map((w) => `${w.title}: ${w.message}`),
          });
          return;
        }
        const trimmed = title.trim();
        const target = parsed.entries.find((d) => d.title === trimmed);
        if (!target) {
          sendJson(res, 404, { error: `decision "${trimmed}" not found` });
          return;
        }
        if (target.status !== 'decided') {
          sendJson(res, 409, { error: `decision "${trimmed}" is already ${target.status}` });
          return;
        }
        // Titles become `##` headings and are the key for lookups/Superseded-by pointers:
        // a newline corrupts the record, a duplicate makes supersession ambiguous.
        const nextTitle = newTitle.trim();
        if (/[\r\n]/.test(nextTitle)) {
          sendJson(res, 400, { error: 'newTitle must be a single line' });
          return;
        }
        if (parsed.entries.some((d) => d.title === nextTitle)) {
          sendJson(res, 409, { error: `decision "${nextTitle}" already exists` });
          return;
        }

        target.status = 'superseded';
        target.supersededBy = nextTitle;
        parsed.entries.push({
          title: nextTitle,
          date: todayDateString(),
          status: 'decided',
          tags: target.tags,
          body: rationale?.trim() ?? '',
        });

        const updated = formatDecisions(parsed.entries);
        await writeFile(decisionsPath, `${updated}\n`, 'utf-8');

        sendJson(res, 200, { ok: true });
      },
    },

    // Graduates a clarification that outlives its entity into open-questions.md,
    // the middle tier of the clarification → open question → decision chain.
    {
      method: 'POST',
      path: '/api/clarifications/promote',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { entityId, clarification } = JSON.parse(reqBody) as {
          entityId?: string;
          clarification?: LogEntry;
        };
        if (!entityId?.trim() || !clarification?.text?.trim()) {
          sendJson(res, 400, { error: 'entityId and clarification are required' });
          return;
        }

        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        const target = entries.find((e) => e.id === entityId);
        if (!target) {
          sendJson(res, 404, { error: `entity "${entityId}" not found` });
          return;
        }
        const primaryFile = join(ideasDir, `${target.id}.md`);
        const targetFile = (await fileExists(primaryFile))
          ? primaryFile
          : join(ideasDir, 'archive', `${target.id}.md`);
        if (!(await fileExists(targetFile))) {
          sendJson(res, 404, { error: 'entity file not found' });
          return;
        }
        const clarifications = target.clarifications ?? [];
        const matchIndex = clarifications.findIndex(
          (c) => c.date === clarification.date && c.text === clarification.text,
        );
        if (matchIndex === -1) {
          sendJson(res, 404, { error: 'clarification not found' });
          return;
        }
        const remaining = clarifications.filter((_, i) => i !== matchIndex);

        const questionBlock = formatOpenQuestionEntry({
          title: clarification.text,
          raised: todayDateString(),
          status: 'open',
          blocks: target.id,
        });
        await appendBlock(campFile(root, 'open-questions.md'), questionBlock);

        await writeEntityFile(
          targetFile,
          entityFileInput(target, { clarifications: remaining, updated: todayDateString() }),
        );

        sendJson(res, 201, { ok: true });
      },
    },

    // Promotes a comment or clarification straight into decisions.md, reusing
    // the same entity-lookup-then-append shape as clarification promotion.
    {
      method: 'POST',
      path: '/api/decisions/promote',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { entityId, source, entry, title, rationale } = JSON.parse(reqBody) as {
          entityId?: string;
          source?: 'comment' | 'clarification';
          entry?: LogEntry;
          title?: string;
          rationale?: string;
        };
        if (!entityId?.trim() || !source || !entry?.text?.trim() || !title?.trim()) {
          sendJson(res, 400, { error: 'entityId, source, entry, and title are required' });
          return;
        }
        if (source !== 'comment' && source !== 'clarification') {
          sendJson(res, 400, { error: 'source must be "comment" or "clarification"' });
          return;
        }

        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        const target = entries.find((e) => e.id === entityId);
        if (!target) {
          sendJson(res, 404, { error: `entity "${entityId}" not found` });
          return;
        }
        const primaryFile = join(ideasDir, `${target.id}.md`);
        const targetFile = (await fileExists(primaryFile))
          ? primaryFile
          : join(ideasDir, 'archive', `${target.id}.md`);
        if (!(await fileExists(targetFile))) {
          sendJson(res, 404, { error: 'entity file not found' });
          return;
        }

        const field = source === 'comment' ? 'log' : 'clarifications';
        const list = target[field] ?? [];
        const matchIndex = list.findIndex((e) => e.date === entry.date && e.text === entry.text);
        if (matchIndex === -1) {
          sendJson(res, 404, { error: `${source} not found` });
          return;
        }
        const remaining = list.filter((_, i) => i !== matchIndex);

        // Titles key the decision record (a `##` heading); reject a newline that would
        // corrupt it and a duplicate that would make later lookups/supersession ambiguous.
        const decisionTitle = title.trim();
        if (/[\r\n]/.test(decisionTitle)) {
          sendJson(res, 400, { error: 'title must be a single line' });
          return;
        }
        const decisionsRaw = await readMaybe(campFile(root, 'decisions.md'));
        if (
          decisionsRaw &&
          parseDecisions(decisionsRaw).entries.some((d) => d.title === decisionTitle)
        ) {
          sendJson(res, 409, { error: `decision "${decisionTitle}" already exists` });
          return;
        }

        const decisionBlock = formatDecisionEntry({
          title: decisionTitle,
          date: todayDateString(),
          status: 'decided',
          tags: target.subject ? [...target.tags, target.subject] : target.tags,
          body: rationale?.trim() || entry.text,
        });
        await appendBlock(campFile(root, 'decisions.md'), decisionBlock);

        await writeEntityFile(
          targetFile,
          entityFileInput(target, { [field]: remaining, updated: todayDateString() }),
        );

        sendJson(res, 201, { ok: true });
      },
    },
  ];
}
