import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProvenanceTrail } from '../types/index';
import { resolvePrsByEntity } from './git-pr/pr-lookup';
import { parseTaskLog } from './parse/parser';
import { readEntities } from './readers';
import { deriveStatus } from './status';

async function readFileMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

export function findReleaseLineForId(changelog: string, id: string): string | undefined {
  return changelog
    .split('\n')
    .find((line) => line.includes(`(${id})`))
    ?.trim();
}

export async function resolveEntityTrail(root: string, id: string): Promise<ProvenanceTrail> {
  const [{ entries }, prs, taskLogRaw, changelogRaw] = await Promise.all([
    readEntities(join(root, 'papercamp', 'ideas')),
    resolvePrsByEntity(root),
    readFileMaybe(join(root, 'papercamp', 'tasks.log')),
    readFileMaybe(join(root, 'CHANGELOG.md')),
  ]);

  const entry = entries.find((e) => e.id === id);
  const pr = prs?.get(id);
  const taskRuns = parseTaskLog(taskLogRaw).filter((t) => t.planId === id);
  const releaseLine = findReleaseLineForId(changelogRaw, id);

  return {
    id,
    idea: entry
      ? {
          reached: true,
          data: {
            title: entry.title,
            status: deriveStatus(entry, pr, prs !== undefined),
            type: entry.type,
          },
        }
      : { reached: false },
    phases: entry ? { reached: entry.phases.length > 0, data: entry.phases } : { reached: false },
    taskRuns: { reached: taskRuns.length > 0, data: taskRuns },
    commits: { reached: false },
    pr: pr ? { reached: true, data: pr } : { reached: false },
    releaseLine: releaseLine ? { reached: true, data: releaseLine } : { reached: false },
  };
}
