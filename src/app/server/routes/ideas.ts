import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assignEntityId, formatEntityFile, todayDateString } from '../../../core/serializer';
import { campFile, regenerateIndexes } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function ideaRoutes({ root }: RouteContext): Route[] {
  return [
    // POST /api/ideas — create a new entity ("New idea": refine-first, or a note)
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
  ];
}
