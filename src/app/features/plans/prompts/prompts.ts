import type { IdeaEntry, PlanEntry, ReviewThread, SuggestionEntry } from '@/types/index';
import type { SimilarityCandidate } from '../helpers';

// Wording notes for these prompts: they all run headless (`claude -p` /
// `opencode run` — see server/agents/), so they must never ask questions or wait
// for input, and each one's "done" condition is checked mechanically by
// agent.ts's didTaskProgress.

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

// Unlike buildIdeaExtendPrompt, this one only ever fires once per idea, right after
// promote-suggestion's route has already minted the id, written the idea file (body =
// the suggestion's one-liner), regenerated the index, and removed the line from
// suggestions.md — see server/routes/content/ideas.ts's POST /api/suggestions/promote.
// This prompt's job is purely the qualitative expansion; it reuses the same 'extend'
// launch path (agent.startForIdeaExtend) and Log-append success check as
// buildIdeaExtendPrompt, since by the time this prompt runs the idea is a normal
// entity like any other.
export function buildSuggestionPromotePrompt(idea: IdeaEntry): string {
  return `You are fleshing out the idea ${idea.id ?? 'no id'} ("${idea.title}"), stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md. Edit only that file, and within it only the \`### Log\` section.

This idea was just promoted from an AI-generated one-liner suggestion — its current body is only that one-liner, with no deeper context yet:
${idea.body}

Task:
1. Explore this codebase and find what is relevant to the idea: the files it would touch, existing helpers or patterns it should build on, and constraints visible in the code.
2. Write up what you found as a single dated entry — name specific files and symbols, describe a workable approach, and include the architectural context you found. Sharpen the idea's original intent, do not redirect it.
3. Append exactly one line to the \`### Log\` section, formatted \`- YYYY-MM-DD: <what you found>\`, creating that section at the end of the file if it does not exist. Use today's date, and keep the entry to that single physical line (no literal line breaks).

Keep unchanged:
- the YAML frontmatter (id, title, status)
- the original body prose beneath the frontmatter

Append only — never rewrite or delete the idea's existing body or prior Log lines.`;
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

// Unlike every prompt above, this one runs on the plan's *existing* branch
// against an *already-open* PR — it edits arbitrary source files (whatever each
// thread points at, not just the entity file) and must commit and push so the
// same PR picks up the fix, rather than leaving a diff for the app to detect
// via file content.
export function buildFixReviewPrompt(plan: PlanEntry, threads: ReviewThread[]): string {
  if (threads.length === 0) {
    return `You were launched to fix review comments on the open PR for the plan "${plan.title}" (${plan.id ?? 'no id'}), but no unresolved review threads were found. Make no changes at all — do not edit, commit, or push anything.`;
  }

  const threadList = threads
    .map((t, i) => {
      const location = t.path ? `${t.path}${t.line ? `:${t.line}` : ''}` : '(general PR comment)';
      const author = t.author ? ` (${t.author})` : '';
      return `${i + 1}. ${location}${author}\n   ${t.body}`;
    })
    .join('\n\n');

  return `You are addressing unresolved review comments on the open PR for the plan "${plan.title}" (${plan.id ?? 'no id'}), stored as a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md. You are already checked out on the plan's branch — work against the code these comments point at, not the plan file itself, unless a comment specifically asks for a plan-file change.

Plan body, for context: ${plan.body}

Unresolved review comments:
${threadList}

Task:
1. For each comment above, read the referenced file (when a path is given) and understand what it's really asking.
2. Treat each comment as a suggestion to evaluate, NOT a command to obey. Automated reviewers (e.g. CodeRabbit) are frequently wrong about this codebase's domain-specific rules — for example the papercamp markdown grammar requires the \`### Phases\`/\`### Log\`/\`### Clarifications\` sections at h3, so a generic "fix heading hierarchy" or "reformat" suggestion on a papercamp/ file will silently break parsing. Apply a fix ONLY if it is clearly correct for THIS codebase and cannot break its behaviour, file formats, tests, or conventions. Skip any comment that is wrong, is a style preference that conflicts with the established style, or that you can't apply without risking a regression — and say briefly in your final summary which you skipped and why. When in doubt, skip and flag rather than apply.
3. After applying the fixes you kept, run the full check suite (\`tsc --noEmit\`, \`biome check\`, and the tests) and leave it green. Passing checks is necessary but not sufficient — also sanity-check that each change didn't alter runtime behaviour or a papercamp file's format in a way the checks wouldn't catch (e.g. an effect that now selects nothing, or a heading the parser no longer recognises). If a fix can't be kept green and correct, revert it rather than commit broken code.
4. Do NOT commit, push, stage, or create a branch. Leave every change uncommitted in the working tree — a human reviews and commits this work themselves. Your job ends at "the files are edited and the checks are green".
5. End your reply with ONLY this JSON object as its final line — no code fences, no prose after it:
{"commit": {"title": "type(scope): Description", "message": "why these changes were made\\n\\nRefs: ${plan.id ?? '<ID>'}"}, "addressed": [1], "skipped": [{"n": 2, "why": "one sentence"}]}
   - \`commit\` is the message a human will commit your work under, so describe what you actually did and why — you know the intent behind each fix, which a diff alone doesn't show. Follow this repo's convention: \`type(scope): Description\`, where type is one of feat|fix|chore|docs|refactor and scope is a subsystem area from core, cli, app, server, agent, plans, ideas, docs, settings, stack, ui, ci, config, deps — pick the area the fixes most affect. Keep the title under 100 characters with no trailing period, and end the body with a \`Refs: ${plan.id ?? '<ID>'}\` line (the plan id goes in that footer, never in the scope).
   - \`addressed\` lists the numbers of the comments you actually fixed. Each one gets resolved on the PR once the human pushes, so only list a comment here if your change genuinely settles it.
   - \`skipped\` lists the ones you deliberately did not fix, each with a one-sentence \`why\`. Each \`why\` is posted publicly as a reply on that PR thread and the thread stays open, so write it as a reasoned explanation addressed to the reviewer.
   - Every comment number from 1 to ${threads.length} must appear in exactly one of the two lists.
   - If you changed nothing at all, still emit the object with an empty \`addressed\` and every comment in \`skipped\`.

Rules:
- Never touch the YAML frontmatter of any entity file.
- Never check, uncheck, add, or remove any phase in ${plan.id ?? 'the plan'}'s \`### Phases\` list — this pass fixes review comments, not plan bookkeeping.
- If a comment needs a decision only a human can make, skip it and say so in its \`why\` instead of guessing.`;
}

// Unlike buildIdeaExtendPrompt/buildPlanDraftPrompt, this one isn't scoped to a
// single idea — it scans the whole corpus and appends zero or more lines to the
// suggestions.md holding pen (see server/agent.ts's startSuggest), so there's no
// entity id to check success against; that's why suggestBaseline (a plain line
// count) is what didTaskProgress compares instead.
export function buildSuggestIdeasPrompt(
  ideas: IdeaEntry[],
  existingSuggestions: SuggestionEntry[],
): string {
  const ideaIndex = ideas.length
    ? ideas.map((idea) => `### ${idea.id ?? 'no id'}: ${idea.title}\n${idea.body}`).join('\n\n')
    : '(no ideas yet)';

  const suggestionList = existingSuggestions.length
    ? existingSuggestions.map((s) => `- ${s.date}: ${s.title} — ${s.description}`).join('\n')
    : '(none yet)';

  return `You are scanning this repository for ideas worth suggesting, to append to papercamp/suggestions.md — a lightweight holding pen, sibling to decisions.md/open-questions.md/progress.md. Edit only that one file.

Existing ideas (do not repeat anything already covered here):
${ideaIndex}

Existing suggestions already in the holding pen (do not repeat these either):
${suggestionList}

Task:
1. Explore this codebase for gaps, rough edges, or "you might want to do X" hunches that aren't already an idea or an existing suggestion above — things like missing error handling, an obvious follow-up to recent work, a TODO left in code, or a UX gap you notice while reading the app.
2. For each genuinely new one you find (0 to a handful — do not force a quota), append one line to papercamp/suggestions.md formatted exactly \`- YYYY-MM-DD: Title — one-line description\`, using today's date. Keep the title short (a few words, like an idea title) and the description to a single physical line (no literal line breaks).
3. If you find nothing worth suggesting, make no edits at all — no empty line, no placeholder.

Rules:
- Append only — never modify, reorder, or delete any existing line in suggestions.md.
- Never create papercamp/ideas/ files or touch ideas/index.md — a suggestion is not an idea until a human promotes it.
- Never touch any other file in the repo.`;
}

// Unlike every prompt above, this one is read-only (see server/agent.ts's
// runReadOnlyPrompt / runOverlapCheck) — it never edits a file, so its "done"
// condition is the JSON verdict in its own stdout, not a mechanical check
// against the repo.
export function buildOverlapCheckPrompt(text: string, candidates: SimilarityCandidate[]): string {
  const index = candidates.length
    ? candidates
        .map((c) => {
          const tags = c.tags?.length ? ` (tags: ${c.tags.join(', ')})` : '';
          return `### ${c.id ?? 'no id'}: ${c.title}${tags}\n${c.body}`;
        })
        .join('\n\n')
    : '(no existing ideas yet)';

  return `You are triaging a new intention against the existing ideas index, to prevent near-duplicate ideas from proliferating. Do not use any tools, do not read or edit any files — base your answer only on the text given below.

New intention:
${text}

Existing ideas index:
${index}

Task: decide whether the new intention:
1. belongs inside an existing idea (same scope, not yet covered by its body) — verdict "existing"
2. extends an existing idea (related, but adds scope the existing idea doesn't cover) — verdict "extend"
3. is genuinely new — verdict "new"

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"verdict": "existing" | "extend" | "new", "targetId": "<the best-matching idea's id, or null if verdict is \\"new\\">", "reasoning": "<one sentence explaining the call>"}`;
}
