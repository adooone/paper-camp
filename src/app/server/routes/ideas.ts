import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readIdeasMerged } from '../../../core/readers';
import { formatIdeaFile } from '../../../core/serializer';
import { campFile, regenerateIndexes } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function ideaRoutes({ root }: RouteContext): Route[] {
  return [
    // POST /api/ideas — create a new per-file idea entry
    {
      method: 'POST',
      path: '/api/ideas',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { title, content } = JSON.parse(reqBody) as { title?: string; content?: string };
        if (!title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
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
        const ideaContent = formatIdeaFile({
          id: newId,
          title: title.trim(),
          body: content?.trim(),
        });
        await writeFile(join(ideasDir, `${newId}.md`), `${ideaContent}\n`, 'utf-8');
        await regenerateIndexes(root);
        sendJson(res, 201, { ok: true, id: newId });
      },
    },
  ];
}
