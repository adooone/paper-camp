import { spawn } from 'node:child_process';
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

// A release-please release line is `* **scope:** Title (IDEA-N) ([hash](url))` — the
// commit subject it was compiled from, plus the markdown link. Works for both a raw
// commit subject and a release line, so it doubles as the reverse of findReleaseLineForId.
export function resolveIdFromCommitMessage(message: string): string | null {
  const trailer = message.match(/^Refs:\s*([A-Za-z]+-\d+)\s*$/m);
  if (trailer) return trailer[1].toUpperCase();
  const subjectLine = message.split('\n', 1)[0];
  const match = subjectLine.match(/\(([A-Za-z]+-\d+)\)/);
  return match ? match[1].toUpperCase() : null;
}

function findReleaseLineForCommit(changelog: string, sha: string): string | undefined {
  return changelog.split('\n').find((line) => {
    const match = line.match(/\/commit\/([0-9a-f]+)\)/i);
    return match ? match[1].startsWith(sha) || sha.startsWith(match[1]) : false;
  });
}

const BRANCH_ID_RE = /^[a-z]+\/([a-z]+-\d+)-/;

// Git treats a leading dash as an option (e.g. `--output=...`), so reject anything
// that isn't a plain hex commit hash before it ever reaches `runGit`.
export const COMMIT_SHA_RE = /^[0-9a-f]{4,40}$/i;

async function resolveDefaultBranch(root: string): Promise<string> {
  const symbolic = await runGit(root, ['symbolic-ref', 'refs/remotes/origin/HEAD']);
  return symbolic.trim().match(/refs\/remotes\/origin\/(.+)/)?.[1] ?? 'main';
}

async function resolveBranchForId(root: string, id: string): Promise<string | undefined> {
  const refs = await runGit(root, [
    'for-each-ref',
    '--format=%(refname)',
    'refs/heads',
    'refs/remotes',
  ]);
  const target = id.toLowerCase();
  for (const ref of refs.split('\n')) {
    const name = ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/[^/]+\//, '');
    if (BRANCH_ID_RE.exec(name)?.[1] === target) return name;
  }
  return undefined;
}

async function resolveCommitsForEntity(root: string, id: string): Promise<string[]> {
  const branch = await resolveBranchForId(root, id);
  if (!branch) return [];
  const base = await resolveDefaultBranch(root);
  const output = await runGit(root, ['log', '--format=%s', `${base}..${branch}`]);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function runGit(root: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.on('close', () => resolve(stdout));
    proc.on('error', () => resolve(''));
  });
}

// Prefers the commit's own message (works pre-release, off the `Refs:` trailer or a
// squash-merge title) and falls back to the CHANGELOG release line for the same sha.
export async function resolveEntityIdForCommit(root: string, sha: string): Promise<string | null> {
  if (!COMMIT_SHA_RE.test(sha)) return null;

  const message = await runGit(root, ['log', '-1', '--format=%B', sha]);
  const idFromMessage = message ? resolveIdFromCommitMessage(message) : null;
  if (idFromMessage) return idFromMessage;

  const changelog = await readFileMaybe(join(root, 'CHANGELOG.md'));
  const line = findReleaseLineForCommit(changelog, sha);
  return line ? resolveIdFromCommitMessage(line) : null;
}

export async function resolveEntityTrail(root: string, id: string): Promise<ProvenanceTrail> {
  const [{ entries }, prs, taskLogRaw, changelogRaw, commits] = await Promise.all([
    readEntities(join(root, 'papercamp', 'ideas')),
    resolvePrsByEntity(root),
    readFileMaybe(join(root, 'papercamp', 'tasks.log')),
    readFileMaybe(join(root, 'CHANGELOG.md')),
    resolveCommitsForEntity(root, id),
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
    taskRuns: taskRuns.length > 0 ? { reached: true, data: taskRuns } : { reached: false },
    commits: commits.length > 0 ? { reached: true, data: commits } : { reached: false },
    pr: pr ? { reached: true, data: pr } : { reached: false },
    releaseLine: releaseLine ? { reached: true, data: releaseLine } : { reached: false },
  };
}
