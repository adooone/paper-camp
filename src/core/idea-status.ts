import type { IdeaEntry, PlanEntry } from '../types/index';

/**
 * Pure, no I/O — kept out of parser.ts so client-bundled importers (e.g.
 * app-store.ts) don't pull in parser.ts's Node-only file-reading code.
 */
export function deriveIdeaStatuses(ideas: IdeaEntry[], plans: PlanEntry[]): IdeaEntry[] {
  return ideas.map((idea) => {
    if (!idea.id) {
      return { ...idea, status: 'planned' };
    }
    const linkedPlans = plans.filter((p) => p.idea === idea.id);
    if (linkedPlans.length === 0) {
      return { ...idea, status: 'planned' };
    }
    const allDone = linkedPlans.every((p) => p.status === 'done' || p.status === 'dropped');
    return { ...idea, status: allDone ? 'done' : 'planned' };
  });
}
