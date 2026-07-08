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

  return `You are auditing the plan "${plan.title}" (${plan.id ?? 'no id'}) for missing phases. The plan is a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md — if it is not there, it is archived at papercamp/ideas/archive/${plan.id ?? '<ID>'}.md. Edit only that file.

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

export function buildReconcilePrompt(plan: PlanEntry): string {
  const hasPhases = plan.phases.length > 0;
  const noun = hasPhases ? 'plan' : 'idea';
  const phaseList = hasPhases
    ? plan.phases
        .map((phase, i) => `${i + 1}. [${phase.done ? 'x' : ' '}] ${phase.text}`)
        .join('\n')
    : '(none — this is a backlog idea with no phases yet)';

  return `You are reconciling the ${noun} "${plan.title}" (${plan.id ?? 'no id'}), stored as a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md — if it is not there, it is archived at papercamp/ideas/archive/${plan.id ?? '<ID>'}.md. Edit only that file.

${hasPhases ? 'Plan' : 'Idea'} body: ${plan.body}

Current phases:
${phaseList}

Task: this ${noun} has drifted from the codebase — some ${hasPhases ? 'phase descriptions and body prose' : 'body prose'} may reference file paths that moved, code symbols that were renamed or removed, or approaches that were superseded during implementation. Find and fix only that drift.

1. Read the ${noun} above, then inspect the relevant code in this repo to find what has actually changed since the prose was written.
2. Reword only the sentences or phrases that are now stale: fix references and superseded approaches. Leave everything else byte-identical.
3. Do not summarize, restructure, or "improve" prose that is still accurate — an unnecessary rewrite is a failure of this task, not a bonus.

Hard guardrails, never violate these:
- Never touch the YAML frontmatter (id, title, kind, status, created, idea, tags, or any other field).
- Never un-check, check, delete, or reorder any phase line, checked or unchecked.
- Never add or remove phases.
- Never touch the Log or Clarifications sections.
- If nothing is stale, make no edits at all.`;
}

export function buildIdeaExtendPrompt(idea: IdeaEntry): string {
  const logList =
    idea.log && idea.log.length > 0
      ? idea.log.map((entry) => `- ${entry.date}: ${entry.text}`).join('\n')
      : '(none)';

  return `You are expanding the idea ${idea.id ?? 'no id'} ("${idea.title}"), stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md. Edit only that file, and within it only the \`### Log\` section.

Current idea body, in full (do not modify this):
${idea.body}

Prior Log entries:
${logList}

Task:
1. Explore this codebase and find what is relevant to the idea: the files it would touch, existing helpers or patterns it should build on, and constraints visible in the code.
2. Write up what you found as a single dated entry — name specific files and symbols, describe a workable approach, and include the architectural context you found. Keep the idea's original intent — sharpen it, do not redirect it.
3. Append exactly one line to the \`### Log\` section, formatted \`- YYYY-MM-DD: <what you found>\`, creating that section at the end of the file if it does not exist. Use today's date, and keep the entry to that single physical line (no literal line breaks).

Keep unchanged:
- the YAML frontmatter (id, title)
- the \`## ${idea.id ?? 'IDEA-N'}: ${idea.title}\` heading line and the original body prose beneath it

Append only — never rewrite or delete the idea's existing body or prior Log lines.`;
}

export function buildClarifyPrompt(plan: PlanEntry): string {
  return `You are clarifying the plan "${plan.title}" (${plan.id ?? 'no id'}), stored as a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md (or papercamp/ideas/archive/${plan.id ?? '<ID>'}.md if archived). Edit only that file, and within it only the \`### Clarifications\` section.

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

  return `You are drafting a plan for the idea ${idea.id ?? 'no id'} ("${idea.title}"), stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md. The idea and its plan are ONE file: you draft the plan by editing that existing file in place — never create a new file.

Idea body, in full:
${idea.body}

## What drafting adds to the file (see papercamp/about.md)

The file already has YAML frontmatter (id, title, status, created, …) and the prose body above. Drafting means:

1. Add a \`type\` field to the frontmatter: the Conventional Commits type that best fits (\`feat | fix | chore | docs | refactor\` — most are \`feat\`).
2. Add 1-4 short subsystem \`tags\` to the frontmatter if it has none.
3. Append a \`### Phases\` checklist at the end of the file (after any \`### Log\` section move it below the phases — Phases, then Log):

\`\`\`
### Phases
- [ ] Short phase title
      Optional description of the phase, indented with 6 spaces.
\`\`\`

Hard rules:
- Never change the \`id\`, \`title\`, \`status\`, or \`created\` fields — \`status\` stays exactly \`idea\`; a human promotes it after reviewing your draft (per papercamp/decisions.md, "Plan-drafting agent writes directly, same as phase execution").
- Never rewrite or delete the existing prose body or \`### Log\` entries — the idea's history stays intact.
- Phases: actionable steps a future agent or human could pick up one at a time — match the granularity of the phases in the entities shown below, not one giant phase.

## Every other open (non-done) entity, for scope context

${plansContext}

Use the open entities above only to avoid duplicating in-flight scope and to match phase granularity. Edit only papercamp/ideas/${idea.id ?? '<ID>'}.md — never create, edit, move, or rename any other file.`;
}
