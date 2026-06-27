import type { IdeaEntry, PlanEntry } from '@/types/index';

export function buildConvergenceAuditPrompt(plan: PlanEntry): string {
  const phaseList = plan.phases
    .map((phase, i) => `${i + 1}. [${phase.done ? 'x' : ' '}] ${phase.text}`)
    .join('\n');

  const logList =
    plan.log && plan.log.length > 0
      ? plan.log.map((entry) => `- ${entry.date}: ${entry.text}`).join('\n')
      : '(none)';

  const clarificationsList =
    plan.clarifications && plan.clarifications.length > 0
      ? plan.clarifications.map((entry) => `- ${entry.date}: ${entry.text}`).join('\n')
      : '(none)';

  return `You're auditing the plan "${plan.title}" (${plan.id ?? 'no id'}) in papercamp/plans.md.

Plan body: ${plan.body}

Current phases:
${phaseList}

Log entries (issues, bugs, and review notes documented so far):
${logList}

Clarifications (answered questions about scope and design):
${clarificationsList}

Read this plan's phases, body, Log entries, and Clarifications, then inspect the current repo state. The Log entries often document bugs, UX issues, or missing functionality that should be turned into new phases. Append any phase that's clearly required but missing as a normal \`- [ ]\` line at the end of the \`### Phases\` list — optionally with the existing indented description format. Explicitly never touch existing lines: never reorder, check, uncheck, or rewrite anything already there, no matter how stale or redundant it looks.

If you append anything, finish with exactly one new \`### Log\` line (date: summary) describing what was found and appended.

If nothing is missing, write nothing at all — not even an empty heading or a Log line. The audit must be safe to re-run anytime without producing log spam.`;
}

export function buildIdeaExtendPrompt(idea: IdeaEntry): string {
  return `You're extending an idea in papercamp/ideas.md: ${idea.id ?? 'no id'} ("${idea.title}").

Idea body, in full:
${idea.body}

Your job: explore the current codebase and rewrite this idea's body in place in ideas.md with more specific detail — concrete approaches, file references, and any relevant architectural context you find in the code. Keep the idea's heading (${idea.id ?? 'IDEA-N'}: ${idea.title}) unchanged; only update the prose body below it.

Write the full updated body — everything below the heading. Make the description more specific and actionable while keeping the same general intent. Do not change the \`### IDEA-N:\` heading line.`;
}

export function buildClarifyPrompt(plan: PlanEntry): string {
  return `You're clarifying the plan "${plan.title}" (${plan.id ?? 'no id'}) in papercamp/plans.md.

Plan body: ${plan.body}

Current phases:
${plan.phases.length > 0 ? plan.phases.map((p, i) => `${i + 1}. [${p.done ? 'x' : ' '}] ${p.text}`).join('\n') : '(none yet)'}

Scan this plan against: functional scope, data model, UX flow, non-functional attributes, edge cases, terminology, completion signals.

Surface at most 5 highest-impact gaps, one question at a time, each with a **Recommended:** answer. Write accepted answers to \`### Clarifications\` as:

\`\`\`
- YYYY-MM-DD: Q: <question> → A: <answer>
\`\`\`

Only append answered lines. Keep existing clarifications intact. Use today's date.`;
}

export function buildPlanDraftPrompt(idea: IdeaEntry, otherPlans: PlanEntry[]): string {
  const openPlans = otherPlans.filter((p) => p.status !== 'done');
  const plansContext = openPlans.length
    ? openPlans
        .map((p) => {
          const phaseList = p.phases
            .map((ph) => `  - [${ph.done ? 'x' : ' '}] ${ph.text}`)
            .join('\n');
          return `### ${p.id ?? 'no id'}: ${p.title} (status: ${p.status}${p.idea ? `, idea: ${p.idea}` : ''})
${p.body}
${phaseList || '  (no phases yet)'}`;
        })
        .join('\n\n')
    : '(no other open plans exist yet)';

  return `You're drafting a new plans.md entry from an idea: ${idea.id ?? 'no id'} ("${idea.title}") in papercamp/ideas.md.

Idea body, in full:
${idea.body}

## Plan record shape (papercamp/about.md)

Each plan is a \`## <Title>\` heading (a short verb-led headline, 2-6 words) followed by \`**Field:** value\` lines, a free-prose body paragraph, then an optional \`### Phases\` checklist:

\`\`\`
## <Short headline>

**Status:** idea
**Kind:** feat | fix | chore | docs | refactor
**Id:** <KIND>-<N>
**Idea:** ${idea.id ?? 'IDEA-N'}
**Created:** <today, YYYY-MM-DD>
**Tags:** comma, separated

One or two paragraphs of free prose giving context — what this is and why,
in the same voice as the existing entries in plans.md.

### Phases
- [ ] Short phase title
      Optional indented long-form description of the phase.
\`\`\`

- \`Kind\` picks the ID prefix — choose whichever Conventional Commits type
  best fits this idea (most are \`feat\`).
- \`Id\` must come from the persistent per-kind counter in
  \`.paper-camp/config.json\`'s \`nextId\` field — read the current value for
  your chosen \`Kind\` (e.g. \`nextId.feat\`), use it as \`<KIND>-<N>\`, and
  increment that counter in the same write. Never derive the number by
  scanning plans.md for the highest existing one — a deleted plan's number
  must never be reused.
- \`Idea\` must be exactly \`${idea.id ?? "this idea's id"}\` — that backlink is
  what the rest of the dashboard (and this task's own success check) uses to
  find the plan you wrote.
- Write \`Status: idea\`, never anything further along. Per
  papercamp/decisions.md ("Plan-drafting agent writes plans.md directly,
  same as phase execution"), this entry lands straight in the Backlog with
  no separate approval step — a human reviews and promotes it from there,
  the same as any other backlog entry.
- Phases should be genuinely actionable steps a future agent or human could
  pick up one at a time — match the granularity of the existing phases shown
  below, not a single giant phase.

## Every other open (non-done) plan, for priority/ordering context

${plansContext}

## Where to insert it

Plan priority is file order in papercamp/plans.md — earlier means higher
priority. Compare this idea's scope and urgency against every plan listed
above and insert your new \`## Heading\` block at the file position that
actually reflects where it belongs, not appended at the end by default.

If the right position means an existing plan should now sit before or after
where it currently sits, you may move that plan's whole heading block to its
new position — but you must never edit its title, phases, or body while
doing so; a moved block must be byte-for-byte identical content, just
relocated. Do not touch any other plan's content for any other reason.`;
}
