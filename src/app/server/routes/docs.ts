import { writeFile } from 'node:fs/promises';
import { parseOpenQuestions } from '@/core/parser';
import {
  appendBlock,
  formatDecisionEntry,
  formatOpenQuestions,
  todayDateString,
} from '@/core/serializer';
import { campFile, readMaybe } from '../helpers';
import { readBody, requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function docsRoutes({ root }: RouteContext): Route[] {
  return [
    // POST /api/open-questions/resolve?title=... — resolve an open question with a new decision
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

        // Both targets validated — now write the two files.
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
  ];
}
