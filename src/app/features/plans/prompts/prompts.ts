import type { PackageManager } from '@/core/desk-discovery/evidence';
import type {
  IdeaEntry,
  Issue,
  MountContext,
  PhaseItem,
  PlanEntry,
  ReviewThread,
  SuggestionEntry,
  TaskKind,
  ThreadMessage,
} from '@/types/index';
import type { SimilarityCandidate } from '../helpers';

// These prompts run headless (`claude -p` / `opencode run`), so they must never ask
// questions or wait for input; each "done" condition is checked mechanically by agent.ts's didTaskProgress.

const BREVITY_CONTRACT = `Keep phases short: 3-5 phases, each a one-line imperative title. Add a description only when the phase isn't self-explanatory, and keep it to one sentence. Never restate the idea's body and never summarise the work you did.`;

const TITLE_STYLE = `A title is a noun/verb phrase, at most 40 characters (roughly 3-6 words), no em-dash subtitles or trailing clauses — the symptom, mechanism, and detail belong in the body's first paragraph, not the title.`;

const MANUAL_PHASE_RULE =
  'A phase is a unit an agent runs. Anything needing a browser, a device, a human account, or a judgment call is not a phase an agent can run — put it under a `[manual]` marker (`- [ ] [manual] <title>`) or fold it into the body as acceptance, never as a bare phase.';

// Where a mockup, screenshot, diagram, or log excerpt goes so the app can show it (IDEA-322).
export const ASSET_GUIDANCE =
  "A supporting file for this idea — a mockup, a screenshot, a diagram, a log excerpt — goes in `papercamp/assets/<ID>/`, linked from the idea's text as `assets/<name>`; the idea view and the mobile app show it from there.";

// The shape a parked question must take (IDEA-287) — a short question plus pickable
// options beats a paragraph the recipient has to forward to another agent to parse.
export const NEEDS_DECISION_PROTOCOL = `Ask for one question, not a list: if two decisions block the work, ask the first and stop — the run parks again for the second once the first is answered, since one short question is answered far faster than one long one. Never treat as a decision anything the idea body already settles or anything a file or a test can answer; re-read the idea before parking. Shape it as:

NEEDS-DECISION: <one question, at most 140 characters, ending in ?>
OPTION: <at most 80 characters> — <one consequence, at most 100 characters>
OPTION: <two to four options total; the first is your recommendation>
CONTEXT: <at most three sentences; no file paths unless the choice is about a file>`;

// "Fix it here" (IDEA-192) — no plan/idea file to scope this to, so unlike the phase
// runner this fix commits its own work; a human reviews it via ordinary git status.
export function buildIssueFixPrompt(issue: Pick<Issue, 'title' | 'reason' | 'output'>): string {
  const outputBlock = issue.output ? `\n\nLast output:\n${issue.output}` : '';

  return `You are fixing a failure reported on paper-camp's Issues page: "${issue.title}".

${issue.reason}${outputBlock}

Find the root cause in this repo and fix it. Commit the fix yourself once the repo is green — there is no plan or PR review step waiting on this one.

Never run \`git stash\`, \`git reset\`, or \`git checkout\` over working-tree state you did not create yourself — it may be someone else's pending work. To compare against a clean baseline, use read-only \`git diff\` or \`git show HEAD:<file>\` instead.

Comments: do NOT add any comments to the code — none, the code is the documentation, reasoning goes in the commit message. Exception: per docs/CODE_STYLE.md, raw HTML used because folk-ui has no equivalent still needs its one-line inline comment explaining the gap.

You are headless with no browser or display. Verify only with terminal commands (\`pnpm run check-types\`, lint, tests) — never open the app, navigate to a URL, or take screenshots.

If you hit a genuine blocker — an ambiguous requirement or a real product decision only a human can make, not just something you haven't figured out yet — do not guess. Park it and stop without committing:

${NEEDS_DECISION_PROTOCOL}`;
}

const LOCKFILE_INSTALL_COMMANDS: Record<PackageManager, string> = {
  npm: 'npm install',
  pnpm: 'pnpm install',
  yarn: 'yarn install',
  bun: 'bun install',
};

// Settings > Toolbar's "Install toolbar" action (IDEA-247) — no plan/idea file to
// scope this to, so like "Fix it here" this task commits its own work.
export function buildInstallToolbarPrompt(
  viteConfigPath: string,
  packageManager: PackageManager | null,
  pluginVersion: string,
): string {
  const installCmd = LOCKFILE_INSTALL_COMMANDS[packageManager ?? 'npm'];
  const slashIndex = viteConfigPath.lastIndexOf('/');
  const packageJsonPath =
    slashIndex === -1 ? 'package.json' : `${viteConfigPath.slice(0, slashIndex)}/package.json`;

  return `You are wiring up paper-camp's in-app dev toolbar for this project, from its Settings > Toolbar section.

Add \`"@dendelion/paper-camp": "^${pluginVersion}"\` to \`devDependencies\` in \`${packageJsonPath}\` (create \`devDependencies\` if the file has none) — edit the file directly rather than running the package manager's add command, since this task's shell allowlist may not permit it. Then run \`${installCmd}\` to update the lockfile; the dependency is recorded in \`${packageJsonPath}\` even if that command is refused.

Then in \`${viteConfigPath}\`, import the plugin and add its call to the Vite \`plugins\` array (create the array if the config has none):

import paperCamp from '@dendelion/paper-camp/vite';
...
plugins: [paperCamp(), ...]

Leave the rest of the config as it is. Commit the change yourself once the repo is green — there is no plan or PR review step waiting on this one.

Never run \`git stash\`, \`git reset\`, or \`git checkout\` over working-tree state you did not create yourself — it may be someone else's pending work. To compare against a clean baseline, use read-only \`git diff\` or \`git show HEAD:<file>\` instead.

Comments: do NOT add any comments to the code — none, the code is the documentation, reasoning goes in the commit message. Exception: per docs/CODE_STYLE.md, raw HTML used because folk-ui has no equivalent still needs its one-line inline comment explaining the gap.

You are headless with no browser or display. Verify only with terminal commands (\`pnpm run check-types\`, lint, tests) — never open the app, navigate to a URL, or take screenshots.

If you hit a genuine blocker — an ambiguous requirement or a real product decision only a human can make, not just something you haven't figured out yet — do not guess. Park it and stop without committing:

${NEEDS_DECISION_PROTOCOL}`;
}

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

// Not a prompt string like its neighbours — the phase itself is what run-all
// later turns into a prompt via buildAgentPrompt's `phase.description` slot.
export function buildStylePassPhase(): PhaseItem {
  return {
    done: false,
    text: 'Style pass',
    description: `Scope yourself to only the files this plan has changed — compare against the base branch (e.g. \`git diff main...HEAD --name-only\`), never the wider codebase. Read docs/CODE_STYLE.md in full and apply it to those files:

- Delete any comment that fails §7 — the cap is two lines and the default count is zero.
- Move complex logic out of components into hooks/, leaving components rendering what a hook returns.
- Sort files into the by-role folders of §4, and split a file holding more than one component.
- Replace a literal with its design token (§2) and a hand-rolled element with its folk-ui component (§1).
- Extract anything now written three times (§3) — into the feature's helpers/ if it is feature logic, into @/app/utils or @/app/hooks if it is not.
- Apply §5's naming rules: every component's props are a named \`{Component}Props\` interface, duplicate import statements from one module merge into one, and table/list column definitions live outside the JSX.

Behaviour may not change. Finish with \`pnpm check-types\`, \`pnpm lint\` and \`npx vitest run\` all green, and do not edit any test to accommodate a change — a test that has to change means this pass altered behaviour and went too far.`,
  };
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

  return `${buildIdeaFleshOutPrompt(idea, 'expanding', context, keepUnchanged)}

If the workable approach involves steps a later drafting pass would turn into phases, say so with the same rule those phases will follow: ${MANUAL_PHASE_RULE}`;
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

/** Fires once per idea, right after roadmap-promote's route mints the id and writes the
 * idea file (server/routes/content/ideas.ts's POST /api/roadmap/promote); reuses
 * buildIdeaExtendPrompt's launch path and success check, same as buildSuggestionPromotePrompt. */
export function buildRoadmapPromotePrompt(idea: IdeaEntry, horizonTitle: string): string {
  const context = `This idea was just promoted from a roadmap item under "${horizonTitle}" in ROADMAP.md — its current body is only that item's one-line description plus a provenance note, with no deeper context yet:
${idea.body}`;

  return buildIdeaFleshOutPrompt(idea, 'fleshing out', context, PROMOTE_KEEP_UNCHANGED);
}

export function buildPlanDraftPrompt(
  idea: IdeaEntry,
  otherPlans: PlanEntry[],
  redraft = false,
): string {
  const openPlans = otherPlans.filter((p) => p.status !== 'done');
  const plansContext = openPlans.length
    ? openPlans.map((p) => `${p.id ?? 'no id'}: ${p.title} (${p.phases.length} phases)`).join('\n')
    : '(no other open plans exist yet)';
  const phasesStep = redraft
    ? '3. Replace the existing `### Phases` list in place — same position in the file, same list, new contents — rather than appending a second one:'
    : '3. Append a `### Phases` checklist at the end of the file (after any `### Log` section move it below the phases — Phases, then Log):';

  return `You are drafting a plan for the idea ${idea.id ?? 'no id'} ("${idea.title}"), stored as a single file at papercamp/ideas/${idea.id ?? '<ID>'}.md. The idea and its plan are ONE file: you draft the plan by editing that existing file in place — never create a new file.

Idea body, in full:
${idea.body}

## What drafting adds to the file (see papercamp/about.md)

The file already has YAML frontmatter (id, title, status, created, …) and the prose body above. Drafting means:

1. Add a \`type\` field to the frontmatter: the Conventional Commits type that best fits (\`feat | fix | chore | docs | refactor\` — most are \`feat\`).
2. Add 1-4 short subsystem \`tags\` to the frontmatter if it has none.
${phasesStep}

\`\`\`
### Phases
- [ ] Short phase title
      Optional description of the phase, indented with 6 spaces.
\`\`\`

${BREVITY_CONTRACT}

Hard rules:
- Never change the \`id\`, \`title\`, \`status\`, or \`created\` fields — \`status\` stays exactly \`idea\`; a human promotes it after reviewing your draft. (${TITLE_STYLE} Leave the existing title as-is even if it breaks this; never expand it into a symptom-sentence.)
- Never rewrite or delete the existing prose body or \`### Log\` entries — the idea's history stays intact.
- Phases: actionable steps a future agent or human could pick up one at a time, not one giant phase.
- Steps that edit the same files are one phase, not split across several.
- ${MANUAL_PHASE_RULE}
- ${ASSET_GUIDANCE}
${redraft ? '- Only one `### Phases` section may exist when you finish — replace it in place, never leave the old list and append a new one below it.\n' : ''}
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

/** Runs read-only against an open PR's diff, replacing CodeRabbit as the producer
 * end of the review pipeline IDEA-57 already built (fetchUnresolvedThreads →
 * buildFixReviewPrompt consumes what this produces). Deliberately given only the
 * idea's own record — diff, body, phases, thread — never the authoring 'phase'
 * run's transcript or task-log entry, so it can't inherit that run's blind spots. */
export function buildPrReviewPrompt(plan: PlanEntry, diff: string): string {
  const phaseList = plan.phases.length
    ? plan.phases
        .map((phase, i) => `${i + 1}. [${phase.done ? 'x' : ' '}] ${phase.text}`)
        .join('\n')
    : '(no phases)';

  const settled = (plan.thread ?? []).filter(
    (m) => m.kind === 'decision' || m.kind === 'note' || m.kind === 'clarification',
  );
  const settledList = settled.length
    ? settled.map((m) => `- [${m.kind}] ${m.text}`).join('\n')
    : '(none)';

  return `You are reviewing the open PR for the idea "${plan.title}" (${plan.id ?? 'no id'}), stored as a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md. You are a different agent from the one that wrote this code, seeing only the diff and this idea's own record below — not the authoring run's transcript or log — so review with fresh eyes rather than inheriting its reasoning. Do not use any write tools, do not edit, commit, or push anything: this is a read-only review, your only output is the JSON described below.

Idea body, the spec this PR is supposed to deliver:
${plan.body}

Phases this PR claims to complete:
${phaseList}

Decisions, notes, and clarifications already settled on this idea's thread — treat these as settled, do not relitigate them:
${settledList}

Diff under review:
${diff}

Task: review the diff against two things:
1. Spec conformance — does the diff actually deliver what the body and phases above specify? Are the phases it claims complete actually complete? Does it contradict a settled decision listed above?
2. Ordinary code quality — correctness bugs, security issues, and edge cases the diff introduces.

For each genuine issue you find, note the file path and the line it belongs to (as it appears in the diff above) and write a comment explaining it the way a human reviewer would — not restating the diff back. Skip nitpicks and stylistic preferences unless they violate a rule visible in the code you read.

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"verdict": "approve" | "comment" | "request-changes", "assessment": "two or three sentences on the overall diff", "concerns": ["short bullet", "short bullet"], "findings": [{"path": "src/foo.ts", "line": 42, "body": "one comment"}]}

Rules:
- "verdict" reflects your judgment but never blocks the merge — a human always decides; pick "request-changes" only when the diff contradicts the spec or a settled decision above.
- "assessment" is plain prose, two or three sentences, no markdown formatting.
- "concerns" is a list of short plain-text bullets for issues worth flagging that aren't tied to a specific line; leave it empty when there are none.
- "findings" must be empty when the diff is clean — never invent an issue just to have something to say.
- Every "line" must be a line that appears in the diff above for that "path".
- Do not use tools to explore beyond what's needed to judge a finding — this review is scoped to the diff above, not a full audit of the repo.`;
}

// Scans the whole corpus rather than one idea and appends to suggestions.md, so
// there's no entity id to check success against — didTaskProgress compares suggestBaseline (a line count) instead.
export function buildSuggestIdeasPrompt(
  ideas: IdeaEntry[],
  existingSuggestions: SuggestionEntry[],
): string {
  const ideaIndex = ideas.length
    ? ideas
        .map((idea) =>
          idea.status === 'done' || idea.status === 'dropped'
            ? `- ${idea.id ?? 'no id'}: ${idea.title} (status: ${idea.status})`
            : `### ${idea.id ?? 'no id'}: ${idea.title}\n${idea.body}`,
        )
        .join('\n\n')
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
2. For each genuinely new one you find (0 to a handful — do not force a quota), append one line to papercamp/suggestions.md formatted exactly \`- YYYY-MM-DD: Title — one-line description\`, using today's date. ${TITLE_STYLE} Keep the description to a single physical line (no literal line breaks).
3. If you find nothing worth suggesting, make no edits at all — no empty line, no placeholder.

Rules:
- Append only — never modify, reorder, or delete any existing line in suggestions.md.
- Never create papercamp/ideas/ files — a suggestion is not an idea until a human promotes it.
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
      const done = p.phases.filter((phase) => phase.done).length;
      const phaseList = p.phases.length
        ? `\nphases (${done}/${p.phases.length} done):\n${p.phases.map((phase) => `  - [${phase.done ? 'x' : ' '}] ${phase.text}`).join('\n')}`
        : '\nphases: none yet (undrafted)';
      return `${p.id ?? 'no id'}: ${p.title}${tags} — subject: ${p.subject ?? 'none'}, created: ${p.created}, status: ${p.status}${phaseList}\n\n${p.body}`;
    })
    .join('\n\n---\n\n');

  return `You are prioritising the run-order queue of Paper Camp, a planning tool whose corpus lives as markdown in the repo. Each entry below is an idea: a unit of work with a body explaining what it is and why, and a list of phases that are the steps to build it. Position in this queue determines what gets worked on next. Do not use any tools, do not read or edit any files — base your answer only on the text given below.

Current queue, in existing run order:
${queue || '(empty)'}

ROADMAP.md, for horizon and dependency context:
${roadmapText || '(no roadmap file)'}

Task: read each body properly and decide the order they should actually be built in, weighing these in order of importance:

1. Stated blockers. A body may say outright that it waits on something ("blocked on", "depends on", "needs X first"). That dominates everything else — never place an idea ahead of what it says it needs. An idea whose blocker is not in this queue still ranks low, because it cannot start.
2. Dependencies you infer. A \`[[IDEA-N]]\` wikilink is a reference to another idea; read the sentence around it to tell a real dependency from a passing mention. Work that unblocks other queued work goes first.
3. Foundations before the things built on them. If one idea changes a format, a shared component, or a contract that another idea must then use, doing it second means redoing work.
4. Cheap decisive work early. An idea whose first phase resolves an unknown that could invalidate later planning — a measurement, a spike, a decision — is worth more early than a large idea that is merely valuable.
5. Roadmap horizon. Prefer subjects the roadmap places near-term over ones it defers.
6. Size and staleness, as tie-breakers only. A small idea ahead of a large one keeps the queue moving; an idea sitting unstarted a long time deserves a look. Neither outweighs the points above.

Judge size from the phase list, not the body's length. Ignore the existing order except as a tie-break — it may be wrong, and correcting it is the point.

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"order": ["${active[0]?.id ?? 'IDEA-N'}", "..."], "why": ["reason for the first id", "reason for the second id"]}

Rules:
- "order" must contain every id from the current queue exactly once — no id added, dropped, or duplicated.
- "why" must be an array of strings with exactly one entry per "order" entry, at the same index.
- Each "why" entry is one sentence naming what put that idea in that position — the blocker, the dependency, or the trade-off. Do not restate the idea's title or summarise what it does.`;
}

export interface ChatActiveRun {
  label: string;
  taskKind: TaskKind;
  phaseIndex?: number;
}

interface ChatTurnPromptInput {
  text: string;
  branch?: { name: string; dirty: string[] };
  activeRuns: ChatActiveRun[];
  mount?: MountContext;
  fresh?: { replay: ThreadMessage[] };
}

const CHAT_DIRTY_FILE_LIMIT = 10;

const CHAT_PREAMBLE = `You are Paper Scout, this project's own agent, talking with the user in the project chat. This is one long conversation: each later message arrives on its own, so carry what was said. Sound like a sharp, low-ceremony teammate: direct and concise, no restating the question.

The project's AGENTS.md and papercamp/ are the map: read AGENTS.md before you touch the code or the workflow, and papercamp/ideas/<ID>.md holds every idea with its plan. Read files, search the code and look things up instead of guessing.

Write ideas only through the paper-camp MCP tools, never by editing papercamp/ by hand:
- add_idea files a new idea; name its id in your reply.
- append_note posts to an idea's thread; when a message names an idea, post the exchange there.
- update_phase changes a phase of an idea.
- edit_idea changes an idea's title, body or fields.
- append_clarification answers a question a run parked on an idea.
- get_plan and list_plans read the ideas.

Code the user asks for is changed here and now, on the checked-out branch. Run the checks and tests AGENTS.md names when a change warrants it. Commit only when asked, in the repository's commit format. Each message opens with the branch and the active runs: never edit files a running phase is working on, and never run git stash, reset or checkout over changes you did not make. Name ideas by id.`;

function chatSpeaker(message: ThreadMessage): string {
  const speaker = message.from === 'agent' ? 'Scout' : 'User';
  if (message.kind === 'question' && message.entityId) {
    return `${speaker} [question parked on ${message.entityId}, ${message.state ?? 'open'}]`;
  }
  return speaker;
}

function chatBranchLine(branch: ChatTurnPromptInput['branch']): string {
  if (!branch) return 'Branch: unknown';
  if (branch.dirty.length === 0) return `Branch: ${branch.name} (clean)`;
  const shown = branch.dirty.slice(0, CHAT_DIRTY_FILE_LIMIT).join(', ');
  const more = branch.dirty.length - CHAT_DIRTY_FILE_LIMIT;
  return `Branch: ${branch.name}, dirty: ${shown}${more > 0 ? ` (+${more} more)` : ''}`;
}

function chatRunsLine(runs: ChatActiveRun[]): string {
  if (runs.length === 0) return 'Active runs: none';
  const list = runs.map(
    (run) =>
      `${run.label} ${run.taskKind}${run.phaseIndex !== undefined ? ` (phase ${run.phaseIndex + 1})` : ''}`,
  );
  return `Active runs: ${list.join(', ')}`;
}

function chatMountLine(mount: MountContext | undefined): string | null {
  if (!mount?.route && !mount?.focusedIdeaId) return null;
  const where = mount.route ? `on ${mount.route}` : '';
  const focus = mount.focusedIdeaId ? `looking at ${mount.focusedIdeaId}` : '';
  return `The user is ${[where, focus].filter(Boolean).join(', ')}.`;
}

/** One turn of the project chat session (agent.ts's runChatTurn): only the new message
 * and the status the daemon knows, plus the preamble and a replay when the session is fresh. */
export function buildChatTurnPrompt(input: ChatTurnPromptInput): string {
  const status = [
    chatBranchLine(input.branch),
    chatRunsLine(input.activeRuns),
    chatMountLine(input.mount),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
  const turn = `${status}\n\n${input.text}`;
  if (!input.fresh) return turn;
  const replay = input.fresh.replay.length
    ? `The conversation so far, oldest first:\n${input.fresh.replay
        .map((m) => `${chatSpeaker(m)}: ${m.text}`)
        .join('\n')}\n\n`
    : '';
  return `${CHAT_PREAMBLE}\n\n${replay}${turn}`;
}
