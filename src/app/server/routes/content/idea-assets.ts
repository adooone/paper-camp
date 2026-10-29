import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  assetMaxBytes,
  assetMaxFileSizeMb,
  isSafeAssetName,
  listIdeaAssets,
  mimeForAssetName,
  sandboxCspForMime,
} from '@/core/assets';
import { resolveEntityFilePath } from '@/core/corpus';
import type { AssetEntry } from '@/types/index';
import { planFile } from '../../helpers';
import { readJson, requestUrl, sendJson } from '../../http';
import type { Route, RouteContext } from '../types';

export function ideaAssetRoutes({ root, activity }: RouteContext): Route[] {
  const assetsDir = () => planFile(root, 'assets');
  const assetPath = (id: string, name: string) => join(assetsDir(), id, name);

  return [
    {
      method: 'GET',
      path: '/api/ideas/assets',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id?.trim()) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        if (!(await resolveEntityFilePath(root, id))) {
          sendJson(res, 404, { error: `idea "${id}" not found` });
          return;
        }
        const assets = await listIdeaAssets(assetsDir(), id);
        sendJson(res, 200, { ok: true, assets });
      },
    },

    {
      method: 'GET',
      path: '/api/ideas/asset',
      handle: async (req, res) => {
        const params = requestUrl(req).searchParams;
        const id = params.get('id');
        const name = params.get('name');
        if (!id?.trim() || !name) {
          sendJson(res, 400, { error: 'id and name are required' });
          return;
        }
        if (!isSafeAssetName(name)) {
          sendJson(res, 400, { error: 'name must be a single path segment' });
          return;
        }
        let data: Buffer;
        try {
          data = await readFile(assetPath(id, name));
        } catch {
          sendJson(res, 404, { error: 'asset not found' });
          return;
        }
        const mime = mimeForAssetName(name);
        res.statusCode = 200;
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'no-cache');
        const csp = sandboxCspForMime(mime);
        if (csp) res.setHeader('Content-Security-Policy', csp);
        res.end(data);
      },
    },

    {
      method: 'POST',
      path: '/api/ideas/assets',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id?.trim()) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        const { name, dataUri } = (await readJson<{ name?: string; dataUri?: string }>(req)) ?? {};
        if (!name || !dataUri) {
          sendJson(res, 400, { error: 'name and dataUri are required' });
          return;
        }
        if (!isSafeAssetName(name)) {
          sendJson(res, 400, { error: 'name must be a single path segment' });
          return;
        }
        const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          sendJson(res, 400, { error: 'invalid data URI' });
          return;
        }
        const buffer = Buffer.from(match[2], 'base64');
        const maxBytes = assetMaxBytes(root);
        if (buffer.length > maxBytes) {
          sendJson(res, 400, { error: `file exceeds the ${assetMaxFileSizeMb(root)}MB limit` });
          return;
        }
        if (!(await resolveEntityFilePath(root, id))) {
          sendJson(res, 404, { error: `idea "${id}" not found` });
          return;
        }
        await mkdir(join(assetsDir(), id), { recursive: true });
        const filePath = assetPath(id, name);
        await writeFile(filePath, buffer);
        const stats = await stat(filePath);
        const asset: AssetEntry = {
          name,
          size: stats.size,
          type: mimeForAssetName(name),
          modified: stats.mtime.toISOString(),
        };
        activity.notifyChanged();
        sendJson(res, 200, { ok: true, asset });
      },
    },

    {
      method: 'DELETE',
      path: '/api/ideas/asset',
      handle: async (req, res) => {
        const params = requestUrl(req).searchParams;
        const id = params.get('id');
        const name = params.get('name');
        if (!id?.trim() || !name) {
          sendJson(res, 400, { error: 'id and name are required' });
          return;
        }
        if (!isSafeAssetName(name)) {
          sendJson(res, 400, { error: 'name must be a single path segment' });
          return;
        }
        try {
          await unlink(assetPath(id, name));
        } catch {
          sendJson(res, 404, { error: 'asset not found' });
          return;
        }
        activity.notifyChanged();
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
