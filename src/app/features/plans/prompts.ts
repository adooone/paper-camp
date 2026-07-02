import type { IdeaEntry, PlanEntry } from '@/types/index';

// Wording notes for these prompts: all of them except buildClarifyPrompt run
// headless (`claude -p` / `opencode run` — see server/agents/), so they must never
// ask questions or wait for input, and each one's "done" condition is checked
// mechanically by agent.ts's didTaskProgress. buildClarifyPrompt is the exception:
// it is copied to the clipboard for the user to paste into an interactive session.

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

  return `You are auditing the plan "${plan.title}" (${plan.id ?? 'no id'}) for missing phases. The plan is a single file at papercamp/plans/${plan.id ?? '<ID>'}.md — if it is not there, it is archived at papercamp/plans/archive/${plan.id ?? '<ID>'}.md. Edit only that file.

Plan body: ${plan.body}

Current phases:
${phaseList}

Log entries (issues, bugs, and review notes recorded so far):
${logList}

Clarifications (answered scope/design questions):
${clarificationsList}

Task:
1. Read the plan above, then inspect the relevant code in this repo.
2. Identify work that is clearly required to fulfil this plan but is covered by no existing phase. The Log entries are the best source — they often record bugs or gaps that were never turned into phases.
3. If you found missing work: append one \`- [ ] <short phase title>\` line per item at the end of the \`### Phases\` list. You may add detail below a checkbox line as continuation lines indented with 6 spaces. Then append exactly one line to the \`### Log\` section, formatted \`- YYYY-MM-DD: <what was found and appended>\`, creating that section after the Phases list if it does not exist.
4. If nothing is missing: make no edits at all — no Log line, no empty heading, no "nothing found" note. This audit re-runs regularly and must leave no trace when there is nothing to add.

Rules:
- Never modify, reorder, check, uncheck, or delete any existing line, even if it looks stale, wrong, or redundant.
- Never touch the YAML frontmatter.
- Append only: new unchecked phases at the end of the list, plus the single Log line.`;
}

export function buildIdeaExtendPrompt(idea: IdeaEntry): string {
  return `You are expanding the idea ${idea.id ?? 'no id'} ("${idea.title}"), stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md. Edit only that file.

Current idea body, in full:
${idea.body}

Task:
1. Explore this codebase and find what is relevant to the idea: the files it would touch, existing helpers or patterns it should build on, and constraints visible in the code.
2. Rewrite the idea's prose body in that file so it is concrete and actionable: name specific files and symbols, describe a workable approach, and include the architectural context you found. Keep the idea's original intent — sharpen it, do not redirect it.

Keep unchanged:
- the YAML frontmatter (id, title)
- the \`## ${idea.id ?? 'IDEA-N'}: ${idea.title}\` heading line

Replace everything below that heading with the improved body.`;
}

export function buildClarifyPrompt(plan: PlanEntry): string {
  return `You are clarifying the plan "${plan.title}" (${plan.id ?? 'no id'}), stored as a single file at papercamp/plans/${plan.id ?? '<ID>'}.md (or papercamp/plans/archive/${plan.id ?? '<ID>'}.md if archived). Edit only that file, and within it only the \`### Clarifications\` section.

Plan body: ${plan.body}

Current phases:
${plan.phases.length > 0 ? plan.phases.map((p, i) => `${i + 1}. [${p.done ? 'x' : ' '}] ${p.text}`).join('\n') : '(none yet)'}

Task: surface the plan's most important unanswered questions and get them answered by the user, one at a time.

1. Check the plan for gaps in: functional scope, data model, UX flow, non-functional requirements, edge cases, terminology, and completion criteria.
2. Pick the gaps that would most change the implementation — at most 5. If the plan has no meaningful gaps, say so and stop; do not invent questions.
3. Ask the user one question at a time. With each question, propose an answer marked **Recommended:** so the user can accept it with a single word. Wait for the user's reply before asking the next question.
4. After each answered question, append one line to the plan file's \`### Clarifications\` section, creating the section between the body and \`### Phases\` if it does not exist:

\`\`\`
- YYYY-MM-DD: Q: <question> → A: <the user's answer>
\`\`\`

Rules:
- Record only answers the user actually gave (accepting your recommendation counts).
- Append only — never rewrite or delete existing Clarifications lines.
- Use today's date.`;
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

  return `You are drafting a new plan from an idea: ${idea.id ?? 'no id'} ("${idea.title}"), stored at papercamp/ideas/${idea.id ?? '<ID>'}.md.

Idea body, in full:
${idea.body}

## Plan file shape (see papercamp/about.md)

Each plan is its own file at \`papercamp/plans/<KIND>-<N>.md\` (the file name is the plan's id). It has YAML frontmatter, a free-prose body, then a \`### Phases\` checklist:

\`\`\`
---
id: <KIND>-<N>
title: <Short headline>
kind: feat | fix | chore | docs | refactor
status: idea
created: <today, YYYY-MM-DD>
idea: ${idea.id ?? 'IDEA-N'}
tags:
  - app
  - agent
---

One or two paragraphs of free prose giving context — what this is and why,
in the same voice as the plans shown below.

### Phases
- [ ] Short phase title
      Optional description of the phase, indented with 6 spaces.
\`\`\`

Field rules:
- \`title\`: a short verb-led headline, 2-6 words.
- \`kind\`: the Conventional Commits type that best fits this idea (most are \`feat\`). It determines the ID prefix.
- \`id\`: read \`nextId.<kind>\` from \`papercamp/config.json\` (e.g. \`nextId.feat\`), use that number as \`<KIND>-<N>\`, and write the incremented counter back to config.json. Never derive the number by scanning existing plan files for the highest one — a deleted plan's number must never be reused.
- \`idea\`: exactly \`${idea.id ?? "this idea's id"}\`. This backlink is how the dashboard (and this task's own success check) finds the plan you wrote — without it the draft counts as failed.
- \`status\`: exactly \`idea\`, never anything further along. Drafts land in the Backlog and a human promotes them from there (per papercamp/decisions.md, "Plan-drafting agent writes directly, same as phase execution").
- \`tags\`: 1-4 short subsystem tags that fit the idea (the example values above are placeholders).
- Phases: actionable steps a future agent or human could pick up one at a time — match the granularity of the phases in the plans shown below, not one giant phase.

## Every other open (non-done) plan, for scope context

${plansContext}

## What to do

1. Read \`papercamp/config.json\` and take the current \`nextId.<kind>\` value for your chosen kind.
2. Create exactly one new file, \`papercamp/plans/<KIND>-<N>.md\`, in the shape above.
3. Write the incremented counter back to \`papercamp/config.json\`.

Use the open plans above only to avoid duplicating an in-flight plan's scope and to match phase granularity. Never create, edit, move, or rename any other plan file, and never write to the legacy monolithic file \`papercamp/plans.md\` — it is unused under per-file storage.`;
}
