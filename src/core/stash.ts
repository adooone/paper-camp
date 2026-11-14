import { runGit } from './git-log';

export const OWN_STASH_MESSAGE = /^(?:papercamp-sync|papercamp-reconcile|sync-)/;

const STASH_REFLOG_SUBJECT = /^(?:WIP on|On) ([^:]+): ?(.*)$/;

interface StashFile {
  path: string;
  source: string;
  base: string | null;
}

export interface OwnStash {
  index: number;
  sha: string;
  message: string;
  date: string;
  papercampFiles: StashFile[];
  otherFiles: string[];
}

const isCorpusPath = (path: string) => path.startsWith('papercamp/');

function git(root: string, args: string[]): Promise<string> {
  return runGit(root, ['-c', 'core.quotepath=off', ...args]);
}

function lines(output: string): string[] {
  return output.split('\n').filter((line) => line.trim().length > 0);
}

async function readStashFiles(
  root: string,
  sha: string,
): Promise<Pick<OwnStash, 'papercampFiles' | 'otherFiles'>> {
  const papercampFiles: StashFile[] = [];
  const otherFiles: string[] = [];
  const changed = lines(
    await git(root, ['diff', '--name-status', '--no-renames', `${sha}^1`, sha]),
  );
  for (const line of changed) {
    const [status, path] = line.split('\t');
    if (!path) continue;
    if (!isCorpusPath(path)) otherFiles.push(path);
    else if (status !== 'D') papercampFiles.push({ path, source: sha, base: `${sha}^1` });
  }
  const untracked = lines(await git(root, ['ls-tree', '-r', '--name-only', `${sha}^3`]));
  for (const path of untracked) {
    if (isCorpusPath(path)) papercampFiles.push({ path, source: `${sha}^3`, base: null });
    else otherFiles.push(path);
  }
  return { papercampFiles, otherFiles };
}

export async function readOwnStashes(root: string): Promise<OwnStash[]> {
  const list = await git(root, ['stash', 'list', '--format=%gd%x09%H%x09%cs%x09%gs']);
  const stashes: OwnStash[] = [];
  for (const line of lines(list)) {
    const [selector, sha, date, subject] = line.split('\t');
    if (!selector || !sha) continue;
    const message = STASH_REFLOG_SUBJECT.exec(subject ?? '')?.[2] ?? subject ?? '';
    if (!OWN_STASH_MESSAGE.test(message)) continue;
    const index = Number.parseInt(/stash@\{(\d+)\}/.exec(selector)?.[1] ?? '', 10);
    if (Number.isNaN(index)) continue;
    stashes.push({ index, sha, message, date: date ?? '', ...(await readStashFiles(root, sha)) });
  }
  return stashes;
}
