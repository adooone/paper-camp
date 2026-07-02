import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyEnvEntries, parseEnv } from '../../../core/env';
import type { EnvEntry } from '../../../types/index';
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
        const entries = exists ? parseEnv(await readMaybe(envPath)) : [];
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
        const { entries } = JSON.parse(body) as { entries?: EnvEntry[] };
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
        await writeFile(envPath, applyEnvEntries(current, entries));
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
