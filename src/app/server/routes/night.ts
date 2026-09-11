import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { daemonLogPath } from '@/core/daemon-state';
import {
  clearNightProject,
  defaultRegistryPath,
  loadRegistry,
  saveRegistry,
  setNightPause,
  setNightProject,
} from '@/core/machine-registry';
import { computeNightHealthMap, selectNightChunks } from '@/core/night-health';
import { isNightPassRunning, markNightPass } from '@/core/night-shift';
import { readTaskLog } from '@/core/parse';
import { latestCapacity, resetsAtMs } from '@/core/rate-limit';
import { DEFAULT_NIGHT_CONFIG, type NightConfig } from '@/types/index';
import { readMaybe } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

async function findOwnSlug(root: string): Promise<string | null> {
  const registry = await loadRegistry(defaultRegistryPath());
  const resolvedRoot = resolve(root);
  return registry.projects.find((p) => resolve(p.path) === resolvedRoot)?.slug ?? null;
}

async function readNightThreshold(root: string): Promise<number> {
  const raw = await readMaybe(join(root, 'papercamp', 'config.json'));
  if (!raw) return DEFAULT_NIGHT_CONFIG.threshold;
  try {
    const night = (JSON.parse(raw) as { night?: NightConfig }).night;
    return night?.threshold ?? DEFAULT_NIGHT_CONFIG.threshold;
  } catch {
    return DEFAULT_NIGHT_CONFIG.threshold;
  }
}

export function nightRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/night/status',
      handle: async (_req, res) => {
        const registry = await loadRegistry(defaultRegistryPath());
        const mySlug = await findOwnSlug(root);
        const enabled = mySlug !== null && registry.night?.slug === mySlug;
        sendJson(res, 200, {
          enabled,
          pausedUntil: enabled ? (registry.night?.pausedUntil ?? null) : null,
        });
      },
    },
    {
      method: 'POST',
      path: '/api/night/toggle',
      handle: async (req, res) => {
        const { enabled } = JSON.parse(await readBody(req)) as { enabled?: boolean };
        const mySlug = await findOwnSlug(root);
        if (!mySlug) {
          sendJson(res, 400, {
            error: 'this project is not registered — run `paper-camp scan` or `paper-camp init`',
          });
          return;
        }
        const registryPath = defaultRegistryPath();
        const registry = await loadRegistry(registryPath);
        if (enabled) {
          const result = setNightProject(registry, mySlug);
          await saveRegistry(registryPath, result.registry);
        } else if (registry.night?.slug === mySlug) {
          await saveRegistry(registryPath, clearNightProject(registry));
        }
        sendJson(res, 200, { ok: true });
      },
    },
    {
      method: 'POST',
      path: '/api/night/pause',
      handle: async (req, res) => {
        const { paused } = JSON.parse(await readBody(req)) as { paused?: boolean };
        const mySlug = await findOwnSlug(root);
        const registryPath = defaultRegistryPath();
        const registry = await loadRegistry(registryPath);
        if (!mySlug || registry.night?.slug !== mySlug) {
          sendJson(res, 400, { error: 'the night shift is not enabled for this project' });
          return;
        }
        if (!paused) {
          await saveRegistry(registryPath, setNightPause(registry, null));
          sendJson(res, 200, { ok: true, pausedUntil: null });
          return;
        }
        const taskLogRaw = await readMaybe(join(root, 'papercamp', 'tasks.log'));
        const snapshot = latestCapacity(readTaskLog(taskLogRaw))?.snapshot ?? null;
        const resetsAt = snapshot?.unifiedWindows?.five_hour?.resetsAt;
        if (resetsAt === undefined) {
          sendJson(res, 400, { error: 'no capacity snapshot yet — run an agent task first' });
          return;
        }
        const pausedUntil = resetsAtMs(resetsAt);
        await saveRegistry(registryPath, setNightPause(registry, pausedUntil));
        sendJson(res, 200, { ok: true, pausedUntil });
      },
    },
    {
      method: 'POST',
      path: '/api/night/run',
      handle: async (_req, res) => {
        const mySlug = await findOwnSlug(root);
        const registry = await loadRegistry(defaultRegistryPath());
        if (!mySlug || registry.night?.slug !== mySlug) {
          sendJson(res, 400, { error: 'the night shift is not enabled for this project' });
          return;
        }
        if (isNightPassRunning(root)) {
          sendJson(res, 409, { error: 'a night pass is already running for this project' });
          return;
        }
        const [map, threshold] = await Promise.all([
          computeNightHealthMap(root),
          readNightThreshold(root),
        ]);
        const chunkPath = selectNightChunks(map, { threshold, maxChunks: 1 })[0]?.path;
        if (!chunkPath) {
          sendJson(res, 400, {
            error: `no chunk scores above the health threshold (${threshold}) — nothing to review`,
          });
          return;
        }
        const entry = process.argv[1];
        if (!entry) {
          sendJson(res, 500, { error: "could not resolve this process's own entry point" });
          return;
        }
        const logPath = daemonLogPath();
        const fd = openSync(logPath, 'a');
        const child: ChildProcess = spawn(process.execPath, [entry, 'night', 'run', chunkPath], {
          cwd: root,
          detached: true,
          stdio: ['ignore', fd, fd],
        });
        closeSync(fd);
        child.unref();
        markNightPass(root, true);
        child.on('exit', () => markNightPass(root, false));
        sendJson(res, 202, { ok: true, chunkPath });
      },
    },
  ];
}
