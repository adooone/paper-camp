import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyEnvEntries, parseEnv } from '@/core/env';
import type { EnvEntry } from '@/types/index';
import { fileExists, readMaybe } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function envRoutes({ root }: RouteContext): Route[] {
  return [
    // GET /api/env — read the project root's .env, masked client-side only
    {
      method: 'GET',
      path: '/api/env',
      handle: async (_req, res) => {
        const envPath = join(root, '.env');
        const examplePath = join(root, '.env.example');
        const [exists, exampleExists] = await Promise.all([
          fileExists(envPath),
          fileExists(examplePath),
        ]);
        const parsed = exists ? parseEnv(await readMaybe(envPath)) : [];
        // Never send secret values over the wire — only which keys are set. The
        // editor shows a masked placeholder and only submits values the user types.
        const entries = parsed.map((e) => ({ key: e.key, value: '', isSet: true }));
        const exampleKeys = exampleExists
          ? parseEnv(await readMaybe(examplePath)).map((e) => e.key)
          : [];
        const envKeys = new Set(entries.map((e) => e.key));
        const missingKeys = exampleKeys.filter((key) => !envKeys.has(key));
        sendJson(res, 200, { exists, exampleExists, entries, missingKeys });
      },
    },

    // POST /api/env — write the full desired entry set back to .env
    {
      method: 'POST',
      path: '/api/env',
      handle: async (req, res) => {
        const body = await readBody(req);
        // `keep` marks a key the user left untouched — since GET no longer sends
        // secret values, the server backfills its existing value rather than
        // blanking it. New/edited keys carry their value as usual.
        const { entries } = JSON.parse(body) as {
          entries?: (EnvEntry & { keep?: boolean })[];
        };
        if (!Array.isArray(entries)) {
          sendJson(res, 400, { error: 'entries is required' });
          return;
        }
        const keys = new Set<string>();
        for (const entry of entries) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.key)) {
            sendJson(res, 400, { error: `invalid key: ${entry.key}` });
            return;
          }
          if (keys.has(entry.key)) {
            sendJson(res, 400, { error: `duplicate key: ${entry.key}` });
            return;
          }
          keys.add(entry.key);
        }
        const envPath = join(root, '.env');
        const current = await readMaybe(envPath);
        const existing = new Map(parseEnv(current).map((e) => [e.key, e.value]));
        const resolved: EnvEntry[] = entries.map((e) => ({
          key: e.key,
          value: e.keep ? (existing.get(e.key) ?? '') : e.value,
        }));
        await writeFile(envPath, applyEnvEntries(current, resolved));
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
