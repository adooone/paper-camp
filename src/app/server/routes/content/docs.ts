import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseOpenQuestions } from '@/core/parse';
import { readEntities } from '@/core/readers';
import {
  appendBlock,
  formatDecisionEntry,
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
        const remaining = (target.clarifications ?? []).filter(
          (c) => !(c.date === clarification.date && c.text === clarification.text),
        );
        if (remaining.length === (target.clarifications ?? []).length) {
          sendJson(res, 404, { error: 'clarification not found' });
          return;
        }

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
  ];
}
