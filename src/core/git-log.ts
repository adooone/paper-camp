import { spawn } from 'node:child_process';

export const COMMIT_SHA_RE = /^[0-9a-f]{4,40}$/i;

const MERGE_COMMIT_BRANCH_RE = /^Merge pull request #\d+ from \S+\/([a-z]+-\d+)-/i;

export function runGit(root: string, args: string[]): Promise<string> {
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

export async function resolveDefaultBranch(root: string): Promise<string> {
  const symbolic = await runGit(root, ['symbolic-ref', 'refs/remotes/origin/HEAD']);
  return symbolic.trim().match(/refs\/remotes\/origin\/(.+)/)?.[1] ?? 'main';
}

// A release-please release line is `* **scope:** Title (IDEA-N) ([hash](url))` — the
// commit subject it was compiled from, plus the markdown link. Works for both a raw
// commit subject and a release line, so it doubles as the reverse of findReleaseLineForId.
// Pre-squash history also has to fall back to the source branch named in a merge
// commit's own subject, since those predate the `(IDEA-N)` squash-title convention.
export function resolveIdFromCommitMessage(message: string): string | null {
  const trailer = message.match(/^Refs:\s*([A-Za-z]+-\d+)\s*$/m);
  if (trailer) return trailer[1].toUpperCase();
  const subjectLine = message.split('\n', 1)[0];
  const bySubject = subjectLine.match(/\(([A-Za-z]+-\d+)\)/);
  if (bySubject) return bySubject[1].toUpperCase();
  const byMergeBranch = subjectLine.match(MERGE_COMMIT_BRANCH_RE);
  return byMergeBranch ? byMergeBranch[1].toUpperCase() : null;
}

export async function resolveIdsWithMainActivity(root: string): Promise<Set<string>> {
  const branch = await resolveDefaultBranch(root);
  const output = await runGit(root, ['log', '--format=%B%x00', branch]);
  const ids = new Set<string>();
  for (const body of output.split('\x00')) {
    const id = resolveIdFromCommitMessage(body.trim());
    if (id) ids.add(id);
  }
  return ids;
}
