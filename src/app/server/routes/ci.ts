import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchCiReleaseState } from '@/core/ci';
import { deskConfigSchema } from '@/core/parse';
import type { DeskCi } from '@/types/index';
import { sendJson } from '../http';
import type { Route, RouteContext } from './types';

function loadManifestCi(root: string): DeskCi | null {
  let raw: string;
  try {
    raw = readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8');
  } catch {
    return null;
  }
  try {
    const parsed = deskConfigSchema.safeParse(JSON.parse(raw).desk ?? {});
    return parsed.success ? (parsed.data.ci ?? null) : null;
  } catch {
    return null;
  }
}

export function ciRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/ci',
      handle: async (_req, res) => {
        const ci = loadManifestCi(root);
        if (!ci) {
          sendJson(res, 200, null);
          return;
        }
        sendJson(res, 200, await fetchCiReleaseState(ci));
      },
    },
  ];
}
