import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { campFile, readMaybe } from './helpers';

const reviewedShasPath = (root: string) => campFile(root, 'pr-reviews.json');

export async function readReviewedShas(root: string): Promise<Record<string, string>> {
  const raw = await readMaybe(reviewedShasPath(root));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

// Best-effort: a write failure must never crash the review that triggered it —
// worst case the next poll reviews the same head SHA again.
export async function recordReviewedSha(
  root: string,
  entityId: string,
  sha: string,
): Promise<void> {
  const path = reviewedShasPath(root);
  try {
    const current = await readReviewedShas(root);
    current[entityId] = sha;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(current, null, 2)}\n`, 'utf-8');
  } catch (err) {
    console.error(`papercamp: could not record reviewed SHA for ${entityId}:`, err);
  }
}
