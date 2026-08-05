import type {
  EntityEntry,
  IdeaEntry,
  MountContext,
  PlanEntry,
  ReviewThread,
  SuggestionEntry,
  ThreadMessage,
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

function buildIdeaFleshOutPrompt(
  idea: IdeaEntry,
  action: string,
  context: string,
  keepUnchanged: string,
): string {
  return `You are ${action} the idea ${idea.id ?? 'no id'} ("${idea.title}"), stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md. Edit only that file, and within it only the \`### Log\` section.

${context}

${BREVITY_CONTRACT}

Task:
1. Explore this codebase and find what is relevant to the idea: the files it would touch, existing helpers or patterns it should build on, and constraints visible in the code.
2. Write up what you found as a single dated entry — name specific files and symbols, describe a workable approach, and include the architectural context you found. Sharpen the idea's original intent, do not redirect it.
3. Append exactly one line to the \`### Log\` section, formatted \`- YYYY-MM-DD: <what you found>\`, creating that section at the end of the file if it does not exist. Use today's date, and keep the entry to that single physical line (no literal line breaks).

Keep unchanged:
${keepUnchanged}

Append only — never rewrite or delete the idea's existing body or prior Log lines.`;
}

export function buildIdeaExtendPrompt(idea: IdeaEntry): string {
  const logList =
    idea.log && idea.log.length > 0
      ? idea.log.map((entry) => `- ${entry.date}: ${entry.text}`).join('\n')
      : '(none)';

  const context = `Current idea body, in full (do not modify this):
${idea.body}

Prior Log entries:
${logList}`;

  const keepUnchanged = `- the YAML frontmatter (id, title)
- the \`## ${idea.id ?? 'IDEA-N'}: ${idea.title}\` heading line and the original body prose beneath it`;

  return buildIdeaFleshOutPrompt(idea, 'expanding', context, keepUnchanged);
}

const PROMOTE_KEEP_UNCHANGED = `- the YAML frontmatter (id, title, status)
- the original body prose beneath the frontmatter`;

// Fires once per idea, right after promote-suggestion's route mints the id and writes
// the idea file (server/routes/content/ideas.ts's POST /api/suggestions/promote); reuses buildIdeaExtendPrompt's launch path and success check.
export function buildSuggestionPromotePrompt(idea: IdeaEntry): string {
  const context = `This idea was just promoted from an AI-generated one-liner suggestion — its current body is only that one-liner, with no deeper context yet:
${idea.body}`;

  return buildIdeaFleshOutPrompt(idea, 'fleshing out', context, PROMOTE_KEEP_UNCHANGED);
}

// Fires once per idea, right after roadmap-promote's route mints the id and writes the
// idea file (server/routes/content/ideas.ts's POST /api/roadmap/promote); reuses
// buildIdeaExtendPrompt's launch path and success check, same as buildSuggestionPromotePrompt.
export function buildRoadmapPromotePrompt(idea: IdeaEntry, horizonTitle: string): string {
  const context = `This idea was just promoted from a roadmap item under "${horizonTitle}" in ROADMAP.md — its current body is only that item's one-line description plus a provenance note, with no deeper context yet:
${idea.body}`;

  return buildIdeaFleshOutPrompt(idea, 'fleshing out', context, PROMOTE_KEEP_UNCHANGED);
}

export function buildPlanDraftPrompt(idea: IdeaEntry, otherPlans: PlanEntry[]): string {
  const openPlans = otherPlans.filter((p) => p.status !== 'done');
  const plansContext = openPlans.length
    ? openPlans.map((p) => `${p.id ?? 'no id'}: ${p.title} (${p.phases.length} phases)`).join('\n')
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
- Phases: actionable steps a future agent or human could pick up one at a time, not one giant phase.

## Every other open (non-done) plan, for scope context

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
2. Treat each comment as a suggestion to evaluate, NOT a command to obey — automated reviewers are often wrong about this codebase's domain-specific rules (e.g. papercamp's \`### Phases\`/\`### Log\`/\`### Clarifications\` sections must stay at h3, so a generic "fix heading hierarchy" suggestion would break parsing). Apply a fix only if clearly correct for this codebase; when in doubt, skip and say why in your summary.
3. After applying the fixes you kept, run the full check suite (\`tsc --noEmit\`, \`biome check\`, tests) and leave it green — also sanity-check nothing's runtime behaviour or file format broke in a way the checks wouldn't catch. Revert any fix you can't keep green and correct.
4. Do NOT commit, push, stage, or create a branch. Leave every change uncommitted — a human reviews and commits this work themselves.
5. End your reply with ONLY this JSON object as its final line — no code fences, no prose after it:
{"commit": {"title": "type(scope): Description", "message": "why these changes were made\\n\\nRefs: ${plan.id ?? '<ID>'}"}, "addressed": [1], "skipped": [{"n": 2, "why": "one sentence"}]}
   - \`commit\` is the message a human commits your work under: \`type(scope): Description\` (type: feat|fix|chore|docs|refactor; scope: core, cli, app, server, agent, plans, ideas, docs, settings, stack, ui, ci, config, deps), title under 100 characters with no trailing period, body ending with \`Refs: ${plan.id ?? '<ID>'}\`.
   - \`addressed\` lists comment numbers the code now genuinely settles, whether fixed here or already fixed earlier.
   - \`skipped\` lists the rest with a one-sentence \`why\` each — posted publicly as a reply on that PR thread, so write it to the reviewer.
   - Every comment number from 1 to ${threads.length} must appear in exactly one list, even if you changed nothing at all.

Rules:
- Never touch the YAML frontmatter of any entity file.
- Never check, uncheck, add, or remove any phase in ${plan.id ?? 'the plan'}'s \`### Phases\` list — this pass fixes review comments, not plan bookkeeping.
- Do not add explanatory comments to the code. Per docs/CODE_STYLE.md §7 the default is zero: only a one-line, non-derivable *why* ships. Put your reasoning in the commit message, never the source.
- If a comment needs a decision only a human can make, skip it and say so in its \`why\` instead of guessing.`;
}

// Formats whatever a mount fed (IDEA-130 phase 5) into a block Scout reads
// silently — never surfaced to the user, so an absent field is simply omitted.
function formatMountContext(context?: MountContext): string {
  const lines: string[] = [];
  if (context?.route) lines.push(`- Current route in the host app: ${context.route}`);
  if (context?.focusedIdeaId) lines.push(`- Idea focused in the mount: ${context.focusedIdeaId}`);
  if (context?.viewport) {
    lines.push(`- Viewport: ${context.viewport.width}×${context.viewport.height}`);
  }
  if (!lines.length) return '';
  return `\nAmbient context from the surface you're chatting in — use it silently, never mention it explicitly:\n${lines.join('\n')}\n`;
}

// Read-only (server/agent.ts's runReadOnlyPrompt/runFeedbackReply) — never uses
// tools or edits a file itself; it proposes an edit/follow-up as JSON and
// feedback-reply.ts's applyFeedbackEdit + the route apply it deterministically.
export function buildFeedbackReplyPrompt(
  plan: PlanEntry,
  otherEntities: EntityEntry[],
  context?: MountContext,
): string {
  const phaseList = plan.phases.length
    ? plan.phases
        .map((phase, i) => `${i + 1}. [${phase.done ? 'x' : ' '}] ${phase.text}`)
        .join('\n')
    : '(no phases yet)';

  const threadList = (plan.thread ?? []).length
    ? (plan.thread as NonNullable<PlanEntry['thread']>)
        .map((m) => `${m.from === 'agent' ? 'Agent' : 'User'}: ${m.text}`)
        .join('\n')
    : '(empty thread)';

  const otherIdeasList = otherEntities.length
    ? otherEntities
        .map((e) =>
          e.status === 'done' || e.status === 'dropped'
            ? `- ${e.id}: ${e.title} (status: ${e.status})`
            : `### ${e.id}: ${e.title} (status: ${e.status ?? 'unknown'})\n${e.body}`,
        )
        .join('\n\n')
    : '(no other ideas exist in this project yet)';

  return `You are Paper Scout, this project's own agent identity — the same Scout that opens draft PRs and cuts releases in CI, now talking. Sound like a sharp, low-ceremony teammate: direct and concise, no corporate throat-clearing, no over-apologizing, no restating the question back before answering it. Do not use any tools, do not read or edit any files, and do not implement anything — base your answer only on the context given below.

You're chatting inside the idea "${plan.title}" (${plan.id ?? 'no id'}), stored at papercamp/ideas/${plan.id ?? '<ID>'}.md — that's your default scope, and any "edit" you propose always applies to THIS idea, never another one. You can still answer questions about any other idea in the project using the index below.

Idea/plan body:
${plan.body}

Current phases:
${phaseList}

Feedback thread so far, oldest first:
${threadList}

Every other idea in the project, for answering questions outside this one's scope:
${otherIdeasList}
${formatMountContext(context)}
Task: classify the most recent user message and act on it in the same response:
- It asks about a DIFFERENT idea from the index above (its content, status, or existence) — answer from that idea's entry above; never propose an "edit" for it, since edits here only ever apply to the current idea.
- It answers an open question you asked earlier in this thread — reply AND set "answersQuestion" to true, so the answer is kept as a clarification on this idea.
- It's a plain question/comment with nothing to change — just reply.
- It asks for a change this idea/plan should make: add a new phase, reword an existing phase's title or description, or correct body prose that's now wrong — reply AND include an "edit".
- It's a stray thought or review remark with nothing actionable — just reply, acknowledging it; the message itself is already recorded in the thread, so no edit is needed.
- It asks to fix or change something, even about a different area (a failing check, a bug elsewhere, unrelated styling) — CAPTURE it as an "edit" that adds a phase for the fix on THIS idea. Do NOT create a new idea for it: the user wants small fixes tracked and done here, not rerouted. Reply saying you added it here (e.g. "Added that as a fix here — <what>").

A request to fix something is never "out of scope" and never refused — it always becomes an "edit" (a phase on THIS idea) so run-all carries it out here. You NEVER create a new idea from this chat: the user chatting inside an idea means they want the change in THIS idea; if they wanted a separate idea they would create one elsewhere. If you merely have a thought, suggestion, or concern, put it in "reply" as a message and take no other action. When unsure whether a message asks for a change, treat it as a plain reply rather than guessing an edit. When unsure whether a message answers an earlier question, omit "answersQuestion" rather than guessing.

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"reply": "short reply text, continuing the conversation naturally", "answersQuestion": true, "edit": {"phases": [{"op": "add", "text": "Short phase title", "description": "optional detail"}, {"op": "reword", "index": 2, "text": "New phase title", "description": "optional detail"}], "body": "the ENTIRE corrected body text, only when body prose needs a correction"}}

Rules:
- "reply" is always required and is the only thing shown when nothing needs to change — omit "edit" entirely in that case.
- "answersQuestion" is a boolean, only ever true; omit it entirely rather than sending false.
- "edit.phases" entries: "add" appends a new phase at the end; "reword" replaces the title/description of the existing phase at the given 1-based "index" (matching the numbered list above) — never invent an index outside that range.
- When every phase above is already checked ([x]) and the message asks for new or still-missing work, use "add" for a new phase — never "reword" a finished phase to smuggle in new work, since a completed phase never re-runs. Adding a phase to a finished idea reopens it, and the app tracks the new work separately as a Fix rather than rewriting the finished Phases history.
- "edit.body", when present, must be the complete replacement body, not a fragment — reproduce every part that isn't changing, word for word.
- Only include "edit" when the message clearly asks for a change; a fix request always becomes an "edit" (a phase on this idea), never anything else. Never create a new idea, and never decline a fix request with a bare reply.`;
}

// Read-only (server/agent.ts's runReadOnlyPrompt/runFeedbackReply, reused for this
// too) — fires once a chat session goes quiet (routes/agent.ts's feedback-summarize),
// distilling the exchange since the last log entry into one durable line.
export function buildFeedbackSummaryPrompt(plan: PlanEntry, messages: ThreadMessage[]): string {
  const exchange = messages
    .map((m) => `${m.from === 'agent' ? 'Agent' : 'User'}: ${m.text}`)
    .join('\n');

  return `You are Paper Scout, distilling a chat session that just went quiet on the idea "${plan.title}" (${plan.id ?? 'no id'}). Do not use any tools, do not read or edit any files — base your answer only on the exchange given below.

Chat exchange since the last recorded summary:
${exchange}

Task: write ONE concise sentence (no more than 25 words) that a future reader would find worth keeping — what this exchange concluded, decided, or established. If nothing durable came out of it (small talk, an unanswered question, a dead end), say that plainly in one short sentence instead of padding it out.

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"summary": "one sentence"}`;
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
