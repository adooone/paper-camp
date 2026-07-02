import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

const MIME_BY_EXT: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function iconRoutes({ root }: RouteContext): Route[] {
  return [
    // GET /api/icon — serve project icon
    {
      method: 'GET',
      path: '/api/icon',
      handle: async (_req, res) => {
        const assetsDir = join(root, 'papercamp', 'assets');
        for (const [ext, mime] of Object.entries(MIME_BY_EXT)) {
          try {
            const data = await readFile(join(assetsDir, `icon.${ext}`));
            res.statusCode = 200;
            res.setHeader('Content-Type', mime);
            res.setHeader('Cache-Control', 'no-cache');
            res.end(data);
            return;
          } catch {
            /* try next */
          }
        }
        sendJson(res, 404, { error: 'no icon uploaded' });
      },
    },

    // POST /api/icon — upload project icon
    {
      method: 'POST',
      path: '/api/icon',
      handle: async (req, res) => {
        const body = await readBody(req);
        const { dataUri } = JSON.parse(body) as { dataUri?: string };
        if (!dataUri) {
          sendJson(res, 400, { error: 'dataUri is required' });
          return;
        }
        const match = dataUri.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/);
        if (!match) {
          sendJson(res, 400, { error: 'invalid data URI' });
          return;
        }
        const mime = match[1];
        const ext = mime === 'image/svg+xml' ? 'svg' : mime.split('/')[1];
        const buffer = Buffer.from(match[2], 'base64');
        const assetsDir = join(root, 'papercamp', 'assets');
        await mkdir(assetsDir, { recursive: true });
        // Remove any previously uploaded icon with a different extension — GET serves
        // the first extension it finds, so a stale icon.svg would permanently shadow
        // a newly uploaded icon.png.
        await Promise.all(
          Object.keys(MIME_BY_EXT)
            .filter((e) => e !== ext)
            .map((e) => unlink(join(assetsDir, `icon.${e}`)).catch(() => {})),
        );
        await writeFile(join(assetsDir, `icon.${ext}`), buffer);
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
