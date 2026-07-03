#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { campFile, fileExists } from '../app/server/helpers';
import { prependProgressItem } from '../core/serializer';

function gitRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
}

function lastCommitSubject(root: string): string {
  return execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).trim();
}

/**
 * Logs the just-made commit to papercamp/progress.md, run as a post-commit git hook.
 * A no-op outside a papercamp/ project so the hook is harmless if ever run elsewhere.
 */
export async function logLastCommit(root: string): Promise<void> {
  if (!(await fileExists(campFile(root, '')))) return;
  const subject = lastCommitSubject(root);
  if (!subject) return;
  await prependProgressItem(campFile(root, 'progress.md'), `Commit: ${subject}`);
}

async function main() {
  await logLastCommit(gitRoot()).catch(() => undefined);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
