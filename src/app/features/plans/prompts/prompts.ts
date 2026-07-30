import type {
  IdeaEntry,
  LogEntry,
  MarginNote,
  MarginNoteAnchor,
  PlanEntry,
  ReviewThread,
  SuggestionEntry,
} from '@/types/index';
import type { SimilarityCandidate } from '../helpers';

// These prompts run headless (`claude -p` / `opencode run`), so they must never ask
// questions or wait for input; each "done" condition is checked mechanically by agent.ts's didTaskProgress.

export const BREVITY_CONTRACT = `Keep phases short: 3-7 phases, each a one-line imperative title. Add a description only when the phase isn't self-explanatory, and keep it to one sentence. Never restate the idea's body and never summarise the work you did.`;

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

${BREVITY_CONTRACT}

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

/**
 * Turns the human comments on an entity into actual changes. The inverse of
 * reconcile: reconcile may never touch phases, status, or the Log and only fixes
 * prose that drifted from the code; this one exists to act on what the Log says.
 */
export function buildReworkPrompt(plan: PlanEntry, notes: LogEntry[]): string {
  const hasPhases = plan.phases.length > 0;
  const noun = hasPhases ? 'plan' : 'idea';
  const phaseList = hasPhases
    ? plan.phases
        .map((phase, i) => `${i + 1}. [${phase.done ? 'x' : ' '}] ${phase.text}`)
        .join('\n')
    : '(none — this is a backlog idea with no phases yet)';
  const noteList = notes.map((n) => `- ${n.date}: ${n.text}`).join('\n');

  return `You are reworking the ${noun} "${plan.title}" (${plan.id ?? 'no id'}) from its author's notes, stored as a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md — if it is not there, it is archived at papercamp/ideas/archive/${plan.id ?? '<ID>'}.md. Edit only that file.

Current status: ${plan.status}

${hasPhases ? 'Plan' : 'Idea'} body: ${plan.body}

Current phases:
${phaseList}

The author's notes — this is the work to act on:
${noteList}

${BREVITY_CONTRACT}

Task: make the ${noun} reflect these notes, so that acting on the ${noun} afterwards delivers what the author asked for.

1. Read each note and decide what it means for this ${noun}: new work to do, a correction to the body prose, or a statement that something believed finished is not.
2. Add a phase for each piece of new work the notes describe — imperative title line, then an indented description naming the files or areas involved, matching the style of the existing phases.
3. Reword body prose only where a note contradicts it.
4. If the notes mean work remains on a ${noun} marked \`review\` or \`done\`, set \`status\` back to \`in-progress\` so it re-enters the queue. Leave the status alone otherwise.
5. Append one line to the Log recording what you changed, dated today, so these notes are not applied twice.

Hard guardrails, never violate these:
- Never delete or un-check an already-completed phase — finished history stays, new work becomes new phases.
- Never remove or reword the author's own note lines in the Log.
- Never change anything the notes do not ask about: id, title, created, idea, tags, and unrelated prose stay byte-identical.
- Never touch a different file, and never implement the work itself — you are editing the ${noun}, not the codebase.
- If a note is purely a remark with nothing to act on, leave the ${noun} unchanged and say so in your Log line.`;
}

function marginNoteAnchorLabel(plan: PlanEntry, anchor: MarginNoteAnchor): string {
  if (anchor.kind === 'body') return 'the body prose';
  const phase = plan.phases[anchor.index];
  return phase ? `phase ${anchor.index + 1} ("${phase.text}")` : `phase ${anchor.index + 1}`;
}

/**
 * Turns anchored margin notes into actual changes — the counterpart to reconcile
 * (which never reads notes and only fixes drift). Unlike buildReworkPrompt, each
 * note here quotes the specific phase or body prose it is about, not a flat log.
 */
export function buildReworkFromNotesPrompt(plan: PlanEntry, notes: MarginNote[]): string {
  const hasPhases = plan.phases.length > 0;
  const noun = hasPhases ? 'plan' : 'idea';
  const phaseList = hasPhases
    ? plan.phases
        .map((phase, i) => {
          const description = phase.description ? `\n      ${phase.description}` : '';
          return `${i + 1}. [${phase.done ? 'x' : ' '}] ${phase.text}${description}`;
        })
        .join('\n')
    : '(none — this is a backlog idea with no phases yet)';
  const noteList = notes
    .map((n) => `- On ${marginNoteAnchorLabel(plan, n.anchor)}: "${n.prose}"`)
    .join('\n');

  return `You are reworking the ${noun} "${plan.title}" (${plan.id ?? 'no id'}) from margin notes anchored to specific phases or the body prose, stored as a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md — if it is not there, it is archived at papercamp/ideas/archive/${plan.id ?? '<ID>'}.md. Edit only that file.

Current status: ${plan.status}

${hasPhases ? 'Plan' : 'Idea'} body: ${plan.body}

Current phases:
${phaseList}

The author's margin notes — this is the work to act on, each quoted against what it is about:
${noteList}

${BREVITY_CONTRACT}

Task: make the ${noun} reflect these notes, so that acting on the ${noun} afterwards delivers what the author asked for.

1. Read each note together with what it is anchored to, and decide what it means: new work to do, a correction to that phase or the body prose, or a statement that something believed finished is not.
2. A note anchored to a phase is about that phase specifically — reword its title or description, or add a new phase near it, rather than editing unrelated parts of the ${noun}.
3. A note anchored to the body prose is about the ${noun}'s overall description — reword only the part of the body it contradicts.
4. Add a phase for each piece of new work a note describes — imperative title line, then an indented description naming the files or areas involved, matching the style of the existing phases.
5. If the notes mean work remains on a ${noun} marked \`review\` or \`done\`, set \`status\` back to \`in-progress\` so it re-enters the queue. Leave the status alone otherwise.

Hard guardrails, never violate these:
- Never delete or un-check an already-completed phase — finished history stays, new work becomes new phases.
- Never touch the \`### Notes\` section at all — the app resolves the notes a rework addresses once its result is approved, not you.
- Never change anything the notes do not ask about: id, title, created, idea, tags, and unrelated prose stay byte-identical.
- Never touch a different file, and never implement the work itself — you are editing the ${noun}, not the codebase.
- If a note is purely a remark with nothing to act on, leave the ${noun} unchanged.`;
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

${BREVITY_CONTRACT}

Task:
1. Explore this codebase and find what is relevant to the idea: the files it would touch, existing helpers or patterns it should build on, and constraints visible in the code.
2. Write up what you found as a single dated entry — name specific files and symbols, describe a workable approach, and include the architectural context you found. Keep the idea's original intent — sharpen it, do not redirect it.
3. Append exactly one line to the \`### Log\` section, formatted \`- YYYY-MM-DD: <what you found>\`, creating that section at the end of the file if it does not exist. Use today's date, and keep the entry to that single physical line (no literal line breaks).

Keep unchanged:
- the YAML frontmatter (id, title)
- the \`## ${idea.id ?? 'IDEA-N'}: ${idea.title}\` heading line and the original body prose beneath it

Append only — never rewrite or delete the idea's existing body or prior Log lines.`;
}

// Fires once per idea, right after promote-suggestion's route mints the id and writes
// the idea file (server/routes/content/ideas.ts's POST /api/suggestions/promote); reuses buildIdeaExtendPrompt's launch path and success check.
export function buildSuggestionPromotePrompt(idea: IdeaEntry): string {
  return `You are fleshing out the idea ${idea.id ?? 'no id'} ("${idea.title}"), stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md. Edit only that file, and within it only the \`### Log\` section.

This idea was just promoted from an AI-generated one-liner suggestion — its current body is only that one-liner, with no deeper context yet:
${idea.body}

${BREVITY_CONTRACT}

Task:
1. Explore this codebase and find what is relevant to the idea: the files it would touch, existing helpers or patterns it should build on, and constraints visible in the code.
2. Write up what you found as a single dated entry — name specific files and symbols, describe a workable approach, and include the architectural context you found. Sharpen the idea's original intent, do not redirect it.
3. Append exactly one line to the \`### Log\` section, formatted \`- YYYY-MM-DD: <what you found>\`, creating that section at the end of the file if it does not exist. Use today's date, and keep the entry to that single physical line (no literal line breaks).

Keep unchanged:
- the YAML frontmatter (id, title, status)
- the original body prose beneath the frontmatter

Append only — never rewrite or delete the idea's existing body or prior Log lines.`;
}

// Fires once per idea, right after roadmap-promote's route mints the id and writes the
// idea file (server/routes/content/ideas.ts's POST /api/roadmap/promote); reuses
// buildIdeaExtendPrompt's launch path and success check, same as buildSuggestionPromotePrompt.
export function buildRoadmapPromotePrompt(idea: IdeaEntry, horizonTitle: string): string {
  return `You are fleshing out the idea ${idea.id ?? 'no id'} ("${idea.title}"), stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md. Edit only that file, and within it only the \`### Log\` section.

This idea was just promoted from a roadmap item under "${horizonTitle}" in ROADMAP.md — its current body is only that item's one-line description plus a provenance note, with no deeper context yet:
${idea.body}

${BREVITY_CONTRACT}

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

${BREVITY_CONTRACT}

Hard rules:
- Never change the \`id\`, \`title\`, \`status\`, or \`created\` fields — \`status\` stays exactly \`idea\`; a human promotes it after reviewing your draft.
- Never rewrite or delete the existing prose body or \`### Log\` entries — the idea's history stays intact.
- Phases: actionable steps a future agent or human could pick up one at a time — match the granularity of the phases in the entities shown below, not one giant phase.

## Every other open (non-done) entity, for scope context

${plansContext}

Use the open entities above only to avoid duplicating in-flight scope and to match phase granularity. Edit only papercamp/ideas/${idea.id ?? '<ID>'}.md — never create, edit, move, or rename any other file.`;
}

// Unlike the others, this runs on the plan's existing branch against an open PR and
// edits arbitrary source files; it must commit+push itself since there's no entity diff for the app to detect.
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
   - \`addressed\` lists the numbers of the comments the current code genuinely settles — whether you fixed them in this run or found them already fixed by an earlier commit. Each one gets resolved on the PR, so only list a comment here if the code as it now stands does what the comment asks.
   - \`skipped\` lists the ones you deliberately did not fix, each with a one-sentence \`why\`. Each \`why\` is posted publicly as a reply on that PR thread and the thread stays open, so write it as a reasoned explanation addressed to the reviewer.
   - Every comment number from 1 to ${threads.length} must appear in exactly one of the two lists.
   - If you changed nothing at all, still emit the object — comments already settled by earlier commits go in \`addressed\`, the rest in \`skipped\`.

Rules:
- Never touch the YAML frontmatter of any entity file.
- Never check, uncheck, add, or remove any phase in ${plan.id ?? 'the plan'}'s \`### Phases\` list — this pass fixes review comments, not plan bookkeeping.
- Do not add explanatory comments to the code. Per docs/CODE_STYLE.md §7 the default is zero: only a one-line, non-derivable *why* ships. Put your reasoning in the commit message, never the source.
- If a comment needs a decision only a human can make, skip it and say so in its \`why\` instead of guessing.`;
}

// Read-only (server/agent.ts's runReadOnlyPrompt/runReviewSplit) — never edits a
// file; the app applies an approved split itself once a human accepts it.
export function buildReviewSplitPrompt(plan: PlanEntry, points: LogEntry[]): string {
  const phaseList = plan.phases.length
    ? plan.phases
        .map((phase, i) => `${i + 1}. [${phase.done ? 'x' : ' '}] ${phase.text}`)
        .join('\n')
    : '(no phases yet)';

  const pointList = points.map((p, i) => `${i + 1}. ${p.text}`).join('\n');

  return `You are splitting a human-written review of the finished plan "${plan.title}" (${plan.id ?? 'no id'}) into either rework on this same plan or a new follow-up idea. Do not use any tools, do not read or edit any files, and do not implement anything — base your answer only on the text given below.

Plan body: ${plan.body}

Current phases:
${phaseList}

Review points, written by a human against this finished plan:
${pointList}

Task: for each review point above, decide whether it is:
- "rework" — work this same plan should still do: something incomplete, wrong, or missed within its existing scope. Propose one or more new phases that would fix it, each with a short imperative title and, if useful, a one-line description of the files or areas involved, matching the style of the existing phases.
- "idea" — work outside this plan's scope: a related but separate piece of work that deserves its own plan later. Propose a short title and a one-paragraph body explaining what it is and why it came up during this review.

A point is "rework" only if the fix belongs inside this plan's existing scope; anything that would grow the plan into new territory is "idea" instead — when genuinely unsure, prefer "idea" over silently expanding scope.

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"items": [{"n": 1, "kind": "rework", "phases": [{"text": "Short phase title", "description": "optional detail"}]}, {"n": 2, "kind": "idea", "title": "Idea title", "body": "One paragraph describing the idea and why it came up"}]}

Rules:
- Every point number from 1 to ${points.length} must appear in "items" exactly once, in any order.
- A "rework" item needs a non-empty "phases" array; an "idea" item needs a non-empty "title" and "body". Never include both on the same item.`;
}

// Scans the whole corpus rather than one idea and appends to suggestions.md, so
// there's no entity id to check success against — didTaskProgress compares suggestBaseline (a line count) instead.
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

  return `You are scanning this repository for ideas worth suggesting, to append to papercamp/suggestions.md — a lightweight holding pen. Edit only that one file.

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

// Read-only (server/agent.ts's runReadOnlyPrompt/runOverlapCheck) — never edits a
// file, so success is the JSON verdict in stdout, not a file-based check.
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

// Read-only (server/agent.ts's runReadOnlyPrompt/runPrioritise) — never edits a
// file; the server applies the verdict deterministically through normalizeRunOrder.
export function buildPrioritisePrompt(worklist: PlanEntry[], roadmapText: string): string {
  const active = worklist
    .filter((p) => p.status === 'planned' || p.status === 'in-progress' || p.status === 'review')
    .sort((a, b) => (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY));

  const queue = active
    .map((p) => {
      const tags = p.tags.length ? ` (tags: ${p.tags.join(', ')})` : '';
      return `${p.id ?? 'no id'}: ${p.title}${tags} — subject: ${p.subject ?? 'none'}, created: ${p.created}, status: ${p.status}\n${p.body}`;
    })
    .join('\n\n');

  return `You are prioritising the run-order queue — the ordered set of planned/in-progress/review work, whose position determines what gets worked on next. Do not use any tools, do not read or edit any files — base your answer only on the text given below.

Current queue, in existing run order:
${queue || '(empty)'}

ROADMAP.md, for horizon and dependency context:
${roadmapText || '(no roadmap file)'}

Task: decide the best run order for the queue above, weighing:
- dependencies between ideas (one blocks or unblocks another)
- how close each idea's subject is to the roadmap's near-term horizons vs. later ones
- staleness (an idea sitting unstarted a long time vs. one just added)
- size (a small idea ahead of a large one keeps the queue moving)

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"order": ["${active[0]?.id ?? 'IDEA-N'}", "..."], "why": "one line per entry in order, same index, explaining that id's placement"}

Rules:
- "order" must contain every id from the current queue exactly once — no id added, dropped, or duplicated.
- "why" must have exactly as many lines as "order" has entries, in the same order.`;
}
