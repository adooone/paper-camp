import type { PlanEntry } from '@/types/index';

export function buildConvergenceAuditPrompt(plan: PlanEntry): string {
  const phaseList = plan.phases
    .map((phase, i) => `${i + 1}. [${phase.done ? 'x' : ' '}] ${phase.text}`)
    .join('\n');

  return `You're auditing the plan "${plan.title}" (${plan.id ?? 'no id'}) in papercamp/plans.md.

Plan body: ${plan.body}

Current phases:
${phaseList}

Read this plan's phases and body, then inspect the current repo state. Append any phase that's clearly required but missing as a normal \`- [ ]\` line at the end of the \`### Phases\` list — optionally with the existing indented description format. Explicitly never touch existing lines: never reorder, check, uncheck, or rewrite anything already there, no matter how stale or redundant it looks.

If you append anything, finish with exactly one new \`### Log\` line (date: summary) describing what was found and appended.

If nothing is missing, write nothing at all — not even an empty heading or a Log line. The audit must be safe to re-run anytime without producing log spam.`;
}
