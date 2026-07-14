import { createHash } from 'node:crypto';
import type { PhaseItem } from '../../types/index';

interface PlanContentInput {
  body: string;
  phases: PhaseItem[];
}

/**
 * Hashes a plan's meaningful content (phases + body prose), deliberately
 * ignoring `audited`/`audited-hash` and any other metadata so that
 * stamping the audit fields never changes the hash of the content it
 * describes.
 */
export function computePlanContentHash(plan: PlanContentInput): string {
  const serialized = JSON.stringify({
    body: plan.body,
    phases: plan.phases.map((phase) => ({
      done: phase.done,
      text: phase.text,
      description: phase.description ?? null,
      source: phase.source ?? null,
    })),
  });
  return createHash('sha256').update(serialized).digest('hex');
}
