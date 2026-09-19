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

export interface GitLogCommit {
  hash: string;
  subject: string;
  prefix: string;
  date: string;
  tags: string[];
  isUpstreamHead: boolean;
  pushed: boolean;
  ideaId: string | null;
}

export interface GitLogPage {
  commits: GitLogCommit[];
  upstream: string | null;
  hasMore: boolean;
}

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';
const LOG_FORMAT = `${RECORD_SEP}%H${FIELD_SEP}%s${FIELD_SEP}%cI${FIELD_SEP}%D${FIELD_SEP}%(trailers:key=Refs,valueonly)`;

const CONVENTIONAL_PREFIX_RE = /^([a-z]+(?:\([^)]*\))?):\s*(.+)$/i;

function splitPrefix(subject: string): { prefix: string; subject: string } {
  const match = subject.match(CONVENTIONAL_PREFIX_RE);
  return match ? { prefix: match[1], subject: match[2] } : { prefix: '', subject };
}

function parseDecoration(
  decoration: string,
  upstream: string | null,
): { tags: string[]; isUpstreamHead: boolean } {
  const tags: string[] = [];
  let isUpstreamHead = false;
  for (const raw of decoration.split(',')) {
    const part = raw.trim().replace(/^HEAD -> /, '');
    if (!part) continue;
    if (part.startsWith('tag: ')) {
      tags.push(part.slice('tag: '.length));
    } else if (upstream && part === upstream) {
      isUpstreamHead = true;
    }
  }
  return { tags, isUpstreamHead };
}

function parseIdeaId(refsTrailer: string): string | null {
  const trimmed = refsTrailer.trim();
  return /^[A-Za-z]+-\d+$/.test(trimmed) ? trimmed.toUpperCase() : null;
}

/** Exported for direct testing against `git log`'s %x1f/%x1e-separated output
 * without needing a full repo fixture for every case. */
export function parseGitLogOutput(
  output: string,
  upstream: string | null,
  unpushed: Set<string>,
): GitLogCommit[] {
  return output
    .split(RECORD_SEP)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, rawSubject = '', date = '', decoration = '', refsTrailer = ''] =
        record.split(FIELD_SEP);
      const { prefix, subject } = splitPrefix(rawSubject);
      const { tags, isUpstreamHead } = parseDecoration(decoration, upstream);
      return {
        hash,
        subject,
        prefix,
        date,
        tags,
        isUpstreamHead,
        pushed: upstream !== null && !unpushed.has(hash),
        ideaId: parseIdeaId(refsTrailer),
      };
    });
}

export async function resolveUpstream(root: string): Promise<string | null> {
  const output = await runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const trimmed = output.trim();
  return trimmed || null;
}

export async function readFirstParentLog(
  root: string,
  skip: number,
  pageSize = 30,
): Promise<GitLogPage> {
  const upstream = await resolveUpstream(root);
  const output = await runGit(root, [
    'log',
    '--first-parent',
    `--max-count=${pageSize + 1}`,
    `--skip=${skip}`,
    `--format=${LOG_FORMAT}`,
  ]);

  const unpushed = new Set<string>();
  if (upstream) {
    const revList = await runGit(root, ['rev-list', `${upstream}..HEAD`]);
    for (const line of revList.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) unpushed.add(trimmed);
    }
  }

  const allCommits = parseGitLogOutput(output, upstream, unpushed);
  const hasMore = allCommits.length > pageSize;
  return { commits: allCommits.slice(0, pageSize), upstream, hasMore };
}
