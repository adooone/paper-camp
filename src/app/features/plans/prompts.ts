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

  return `You're auditing the plan "${plan.title}" (${plan.id ?? 'no id'}), stored as a single file at papercamp/plans/${plan.id ?? '<ID>'}.md (or papercamp/plans/archive/${plan.id ?? '<ID>'}.md if it's already done/dropped — check both). Edit only that file.

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
  return `You're extending an idea stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md: ${idea.id ?? 'no id'} ("${idea.title}").

Idea body, in full:
${idea.body}

Your job: explore the current codebase and rewrite this idea's body in place in that file with more specific detail — concrete approaches, file references, and any relevant architectural context you find in the code. Leave the YAML frontmatter (id, title) and the idea's \`### ${idea.id ?? 'IDEA-N'}: ${idea.title}\` heading unchanged; only update the prose body below the heading.

Write the full updated body — everything below the heading. Make the description more specific and actionable while keeping the same general intent. Do not change the \`## IDEA-N:\` heading line.`;
}

export function buildClarifyPrompt(plan: PlanEntry): string {
  return `You're clarifying the plan "${plan.title}" (${plan.id ?? 'no id'}), stored as a single file at papercamp/plans/${plan.id ?? '<ID>'}.md (or papercamp/plans/archive/${plan.id ?? '<ID>'}.md if done/dropped). Edit only that file.

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

  return `You're drafting a new plan from an idea: ${idea.id ?? 'no id'} ("${idea.title}"), stored at papercamp/ideas/${idea.id ?? '<ID>'}.md.

Idea body, in full:
${idea.body}

## Plan file shape (see papercamp/about.md)

Each plan is its own file at \`papercamp/plans/<KIND>-<N>.md\` (the file name is the plan's id). It has YAML frontmatter, a free-prose body paragraph, then an optional \`### Phases\` checklist:

\`\`\`
---
id: <KIND>-<N>
title: <Short headline>
kind: feat | fix | chore | docs | refactor
status: idea
created: <today, YYYY-MM-DD>
idea: ${idea.id ?? 'IDEA-N'}
tags:
  - comma
  - separated
---

One or two paragraphs of free prose giving context — what this is and why,
in the same voice as the existing plan files.

### Phases
- [ ] Short phase title
      Optional indented long-form description of the phase.
\`\`\`

- \`title\` is a short verb-led headline, 2-6 words.
- \`kind\` picks the ID prefix — choose whichever Conventional Commits type
  best fits this idea (most are \`feat\`).
- \`id\` must come from the persistent per-kind counter in
  \`papercamp/config.json\`'s \`nextId\` field — read the current value for
  your chosen \`kind\` (e.g. \`nextId.feat\`), use it as \`<KIND>-<N>\`, and
  increment that counter in the same write. Never derive the number by
  scanning existing plan files for the highest one — a deleted plan's number
  must never be reused.
- \`idea\` must be exactly \`${idea.id ?? "this idea's id"}\` — that backlink is
  what the rest of the dashboard (and this task's own success check) uses to
  find the plan you wrote.
- Write \`status: idea\`, never anything further along. Per
  papercamp/decisions.md ("Plan-drafting agent writes directly, same as
  phase execution"), this entry lands straight in the Backlog with no
  separate approval step — a human reviews and promotes it from there, the
  same as any other backlog entry.
- Phases should be genuinely actionable steps a future agent or human could
  pick up one at a time — match the granularity of the existing phases shown
  below, not a single giant phase.

## Every other open (non-done) plan, for scope context

${plansContext}

## What to write

Create exactly one new file, \`papercamp/plans/<KIND>-<N>.md\`, using the id
you allocated above. Use the list of existing plans only to avoid
duplicating an in-flight plan's scope and to match phase granularity —
never create, edit, move, or rename any other plan file, and never write to
the legacy \`papercamp/plans.md\` (it is unused under per-file storage).`;
}
