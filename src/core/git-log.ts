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

/** Matches a release-please line, a raw commit subject, or (for pre-squash history)
 * a merge commit's own source-branch name, since those predate the `(IDEA-N)` convention. */
export function resolveIdFromCommitMessage(message: string): string | null {
  const trailer = message.match(/^Refs:\s*([A-Za-z]+-\d+)\s*$/m);
  if (trailer) return trailer[1].toUpperCase();
  const subjectLine = message.split('\n', 1)[0];
  const bySubject = subjectLine.match(/\(([A-Za-z]+-\d+)\)/);
  if (bySubject) return bySubject[1].toUpperCase();
  const byMergeBranch = subjectLine.match(MERGE_COMMIT_BRANCH_RE);
  return byMergeBranch ? byMergeBranch[1].toUpperCase() : null;
}

/** Merge commits show no file list under --name-only, so an empty list doesn't imply corpus-only. */
function isCorpusOnly(files: string[]): boolean {
  return files.length > 0 && files.every((f) => f.startsWith('papercamp/'));
}

export async function resolveIdsWithMainActivity(root: string): Promise<Set<string>> {
  const branch = await resolveDefaultBranch(root);
  const output = await runGit(root, ['log', '--format=%x02%B%x00', '--name-only', branch]);
  const ids = new Set<string>();
  for (const commit of output.split('\x02')) {
    if (!commit) continue;
    const [body, fileSection = ''] = commit.split('\x00');
    const files = fileSection
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
    if (isCorpusOnly(files)) continue;
    const id = resolveIdFromCommitMessage(body.trim());
    if (id) ids.add(id);
  }
  return ids;
}
