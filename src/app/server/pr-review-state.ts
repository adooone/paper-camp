import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { campFile, readMaybe } from './helpers';

const reviewedShasPath = (root: string) => campFile(root, 'pr-reviews.json');
const deliveryFailuresPath = (root: string) => campFile(root, 'pr-review-failures.json');

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

interface DeliveryFailureEntry {
  sha: string;
  count: number;
}

async function readDeliveryFailures(root: string): Promise<Record<string, DeliveryFailureEntry>> {
  const raw = await readMaybe(deliveryFailuresPath(root));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DeliveryFailureEntry>;
  } catch {
    return {};
  }
}

async function writeDeliveryFailures(
  root: string,
  entries: Record<string, DeliveryFailureEntry>,
): Promise<void> {
  const path = deliveryFailuresPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8');
}

// A new SHA on the same entity resets the count — the cap tracks consecutive
// failures on one review attempt, not the entity's history overall.
export async function recordDeliveryFailure(
  root: string,
  entityId: string,
  sha: string,
): Promise<number> {
  try {
    const current = await readDeliveryFailures(root);
    const existing = current[entityId];
    const count = existing && existing.sha === sha ? existing.count + 1 : 1;
    current[entityId] = { sha, count };
    await writeDeliveryFailures(root, current);
    return count;
  } catch (err) {
    console.error(`papercamp: could not record delivery failure for ${entityId}:`, err);
    return 1;
  }
}

export async function clearDeliveryFailures(root: string, entityId: string): Promise<void> {
  try {
    const current = await readDeliveryFailures(root);
    if (!(entityId in current)) return;
    delete current[entityId];
    await writeDeliveryFailures(root, current);
  } catch (err) {
    console.error(`papercamp: could not clear delivery failures for ${entityId}:`, err);
  }
}
