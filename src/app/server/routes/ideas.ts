import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assignEntityId, formatEntityFile, todayDateString } from '../../../core/serialize';
import type { SimilarityCandidate } from '../../features/plans/idea-similarity';
import { campFile, regenerateIndexes } from '../helpers';
import { readBody, sendJson } from '../http';
import { checkIdeaOverlap } from '../overlap-check';
import type { Route, RouteContext } from './types';

export function ideaRoutes({ root, agent }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/ideas',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { title, content, kind } = JSON.parse(reqBody) as {
          title?: string;
          content?: string;
          kind?: 'idea' | 'note';
        };
        if (!title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
        const configPath = join(root, 'papercamp', 'config.json');
        const newId = await assignEntityId(configPath);
        if (!newId) {
          sendJson(res, 500, { error: 'could not assign entity ID' });
          return;
        }
        const ideasDir = campFile(root, 'ideas');
        await mkdir(ideasDir, { recursive: true });
        const isNote = kind === 'note';
        const entityContent = formatEntityFile({
          id: newId,
          title: title.trim(),
          kind: isNote ? 'note' : undefined,
          status: isNote ? 'open' : 'idea',
          created: todayDateString(),
          body: content?.trim(),
        });
        await writeFile(join(ideasDir, `${newId}.md`), `${entityContent}\n`, 'utf-8');
        await regenerateIndexes(root);
        sendJson(res, 201, { ok: true, id: newId });
      },
    },

    // Read-only — never edits a file, so unlike launch-draft/launch-extend it returns
    // the verdict directly instead of via polling.
    {
      method: 'POST',
      path: '/api/ideas/check-overlap',
      handle: async (req, res) => {
        try {
          const reqBody = await readBody(req);
          const { text, candidates } = JSON.parse(reqBody) as {
            text?: string;
            candidates?: SimilarityCandidate[];
          };
          if (!text?.trim()) {
            sendJson(res, 400, { error: 'text is required' });
            return;
          }
          const verdict = await checkIdeaOverlap(text, candidates ?? [], agent.runOverlapCheck);
          sendJson(res, 200, verdict);
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },
  ];
}
