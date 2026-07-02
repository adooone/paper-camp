## Docs search lives in the Docs page's own sidebar

**Date:** 2026-07-02
**Status:** decided

**Context:** `FEAT-33`'s navigation redesign removed the floating `NavigationIsland`
in favor of paper-ui `Layout`'s built-in header, which has no page-specific slot —
only shared identity and global nav belong there. That leaves the Docs search input
(previously rendered in the island, only on `/docs`) without a home in the new header.
Supersedes the 2026-06-19 decision to place it in the nav island.

**Decision:** Moved the search input into `DocsSidebar`, above the Repo Docs/
Decisions/Open Questions/Progress sections. Still backed by the same
`docSearchQuery`/`setDocSearchQuery` store state and the paper-ui `Input` component;
only the mount point changed.

**Rationale:** The unified navigation model this plan establishes has exactly two
levels — a global header (identity + nav) and a per-route sidebar for pages with
actual sections. Docs already has a sidebar, and search is Docs-specific, so it
belongs there rather than forcing a page-specific tool into the now-generic header.

## Plan-drafting agent writes plans.md directly, same as phase execution

**Date:** 2026-06-27
**Status:** decided

**Context:** `IDEA-15`/`FEAT-17`'s plan-drafting agent (reads an idea, writes a new
`plans.md` entry) left open whether it should write `plans.md` directly — like
`IDEA-4`/`FEAT-10`'s phase-execution agent does — or produce a draft requiring
approval before anything lands in the file. Drafting an entire plan from a one-
paragraph idea is a looser instruction than executing one named phase, with more
room to misjudge scope, so this wasn't assumed by default.

**Decision:** Write directly, with no separate draft/approval step. The agent's
new entry (and any existing-plan reordering it judges necessary) is written with
`Status: idea`, exactly like `POST /api/plans`'s existing convention for any
newly-created plan — landing it in the Backlog section, not auto-promoted to
`in-progress`. A human reviews it there using the CRUD the Backlog already has
(edit, delete, or promote via the existing Start button); nothing new needs to
be built for review.

**Rationale:** The codebase's existing idiom is "write directly, then gate
follow-on action behind status" — `FEAT-10`'s phase agent writes directly and
relies on `Status: review` (not an auto-`done`) as the after-the-fact human gate;
`POST /api/plans` already writes a brand-new plan straight to the file at
`Status: idea` with zero approval step, because Backlog's full CRUD is itself
the review surface. Building a separate propose/approve flow (draft storage,
diff view, accept/reject actions) would duplicate that surface for no added
safety, since the agent's output is just another `Status: idea` Backlog entry —
exactly as inspectable and discardable as one a human typed in by hand.

## Confirm Claude Code's headless stream-json shape before writing the adapter

**Date:** 2026-06-25
**Status:** decided

**Context:** FEAT-10's planning step required a live smoke test of `claude -p ...
--output-format stream-json --verbose` against an isolated `/tmp` directory (never this
repo) before `claude-code.ts`'s `parseLine()` got written — mirroring the opencode probe
below, so the adapter is built against confirmed behavior instead of assumptions from
`--help` output. Three separate invocations were run: a plain no-tool-needed prompt, a
`-r <sessionId>` resume of that same session, and a prompt that forces a permission-gated
tool call (`Write`) with no `--dangerously-skip-permissions` flag.

**Decision:** Findings, each one a real constraint on the adapter's design:

- True NDJSON, one JSON object per stdout line, confirmed by piping through `tee` and
  inspecting raw output — matches the opencode probe's shape category.
- `type` discriminator values actually seen: `system` (subtypes `init`,
  `thinking_tokens`, `post_turn_summary`), `rate_limit_event`, `assistant` (content
  blocks: `thinking` / `tool_use` / `text`), `user` (wraps `tool_result`, including
  error results), and `result` (subtype `success`, carries `total_cost_usd` and a
  `permission_denials` array). `parseLine()` must treat unknown subtypes/types
  generically rather than enumerate an exhaustive closed set — `thinking_tokens` and
  `post_turn_summary` weren't predictable in advance and more will likely appear.
- `session_id` is a top-level field on **every** line, not just `init` — simpler than
  expected, `agent.ts` can read it off the first line and doesn't need special-case
  logic to find it later in the stream.
- `-r <sessionId>` resume across two separate `claude -p` process invocations verified
  working — the second call correctly recalled the file listing from the first call's
  context, confirming `capabilities.supportsResume = true` for the Claude adapter too.
- Permission-gated tool call (`Write`, no `--dangerously-skip-permissions`) does **not**
  hang and does **not** crash the process: exit code `0`, the denied call surfaces as a
  `user`-type `tool_result` with `is_error: true` and a human-readable message ("Claude
  requested permissions to write to X, but you haven't granted it yet."), the model sees
  that denial and responds in text, and the final `result` event lists the denial in a
  `permission_denials` array. `agent.ts` doesn't need a special hang-detection timeout
  for this case — a denied tool call is just another line in the normal stream,
  collapsible by `parseLine()` like any other event.

**Rationale:** This was the one piece of FEAT-10's plan explicitly *not* allowed to be
guessed by analogy to opencode or to `--help` text — the plan's "Critical correction"
section already caught one contradiction-with-`AGENTS.md` bug during design, and an
unverified stream shape was the other named risk. Running it confirms `parseLine()` can
be written against real output instead of best-guess `type` enumeration, and rules out
needing a hang-detection workaround for permission denials since the CLI already
degrades cleanly on its own.

## Verify opencode's CLI before assuming it generalizes from Claude Code

**Date:** 2026-06-25
**Status:** decided

**Context:** IDEA-4 ("Agent orchestration") explicitly flagged that opencode's headless
invocation, streaming output shape, and session-resume support "still need to be checked
against its actual current CLI/API, not assumed by analogy" before FEAT-10 gets built —
but FEAT-10 was written and scoped without that check ever happening; its first phase
just says "ship a Claude Code adapter first" on faith that the rest generalizes. Both
`claude` and `opencode` CLIs are installed and authenticated in this dev environment, so
the check was finally run directly instead of staying a deferred risk.

**Decision:** Ran two live `opencode run` probes against an isolated `/tmp` directory
(never this repo): one with `--format json` on a no-tool prompt, one testing
`--session <id>` resume across two separate process invocations. Findings:

- `opencode run --format json` streams true incremental NDJSON (one JSON object per
  line, `type`-discriminated: `step_start`, `text`, `step_finish`, ...) — the same shape
  category as Claude Code's `--output-format stream-json`, not a single end-of-run blob.
  A shared adapter event-normalization layer (per IDEA-4's `launch(...) -> stream of
  events` interface) is feasible for both.
- Every event line carries `sessionID` directly, and `step_finish` carries a per-step
  `cost` — both more convenient than expected, and `cost` directly serves IDEA-4's
  "surface real usage against the agent's own quota" decision for free.
- `-s/--session <id>` resume verified working: a second, separate `opencode run`
  invocation correctly recalled a fact from the first session's context. opencode's
  `supportsResume` capability flag should be `true`, not assumed `false` or left unknown.
- Not resolved by this probe: `opencode serve` + `--attach <url>` (a persistent headless
  server, vs. Claude Code's one-subprocess-per-call model) is a real architectural fork
  for the adapter layer — whether to build opencode's adapter as subprocess-per-call
  (matching the Claude adapter's shape) or as a long-lived attached server is still an
  open implementation decision, not yet made.

**Rationale:** Confirming this before FEAT-10's first phase starts (rather than after
the Claude-only adapter interface is already locked in) avoids designing
`launch`/`resume`/event-shape entirely around Claude Code's specifics and then
discovering opencode doesn't fit — the exact failure mode IDEA-4 warned about. The
NDJSON-with-`type`-discriminator shape turning out to match closely means a shared
interface is realistic; the `serve`-vs-subprocess question is the one genuinely new
decision this surfaced and should get made explicitly when FEAT-10's adapter interface
phase starts, not discovered mid-build.

## Split the sidebar's "Ideas" section into "Ideas" and "Backlog"

**Date:** 2026-06-19
**Status:** decided

**Context:** The Plans sidebar's "Ideas" section mixed two unrelated things: prose
sections parsed from `ideas.md` (read-only, no schema, per the storage decision below)
and `plans.md` entries with `Status: idea` (fully CRUD via an "Add idea" modal and
per-item delete). The "Add idea" button created the latter, not a new `ideas.md`
section, despite the shared label implying otherwise.

**Decision:** Kept both concepts — both are real and already used elsewhere (list view
already separates them, grouping idea-status plans under "Backlog" alongside `planned`,
and `ideas.md` prose under its own "Ideas" grid) — but split the sidebar to match: a
read-only "Ideas" section for `ideas.md` entries, and a separate "Backlog" section (with
the add/delete actions) for `Status: idea` plans. Renamed the modal from "Add idea" to
"Add to backlog" to match.

**Rationale:** Dropping either concept would lose working functionality — `ideas.md` is
the deliberate "no schema, hand-edited prose" home for raw thoughts, while idea-status
plans are deliberately lightweight, deletable plan stubs. The actual problem was only
that the sidebar (unlike list view) presented them under one label. Matching the
sidebar's grouping to list view's existing split fixes the confusion without removing
anything. Resolves the open question of the same name.

## Drop the `./app` JS export; dist/app is static-only

**Date:** 2026-06-18
**Status:** decided

**Context:** `package.json` declared `"./app": { "import": "./dist/app/index.js" }`,
implying the dashboard is importable as a JS module. But `vite.app.config.ts` builds it
as a full SPA (`index.html` + assets), not a JS module — the two never matched.

**Decision:** Removed the `./app` export entirely. `dist/app` is purely static assets,
served over HTTP by `paper-camp dev` — not imported by anything.

**Rationale:** There's no current use case for embedding the dashboard's React tree in
another app. Keeping a speculative export that doesn't match the actual build output is
worse than having no export at all. If an embeddable component is ever needed, it can be
added as its own deliberate entry later.

## Docs search lives in the nav island as a page-specific tool

**Date:** 2026-06-19
**Status:** superseded by "Docs search lives in the Docs page's own sidebar" (2026-07-02)

**Context:** The initial implementation placed the Docs page's full-text search input
inside the page content area, at the top of the main content column. This consumed
vertical space on every docs sub-view and felt disconnected from navigation.

**Decision:** Moved the search input to the NavigationIsland, rendered after the logo
and before the nav buttons — only visible on the `/docs` route. The query state lives
in the Zustand store so `DocsPage` can react to it. Uses the paper-ui `Input` component
for visual consistency.

**Rationale:** The nav island is the persistent chrome element present on every page;
placing page-specific tools there keeps the content area clean and establishes a pattern
for future page-specific tools (filters, toggles, etc.) without cluttering the shared
nav buttons. Disappearing the input when leaving `/docs` prevents stale queries from
showing on unrelated pages.

## `paper-camp dev` serves the dashboard via a plain http server

**Date:** 2026-06-18
**Status:** decided

**Context:** Local development uses `pnpm dev` (Vite's dev server with a
`configureServer` plugin for `/api/*`). But an installed consumer has no `vite` runtime
(devDependency only) and none of this repo's app source — just `papercamp/` data and the
installed package.

**Decision:** `src/cli/dev-server.ts` runs a plain `node:http` server: `/api/*` is handled
by `createApiMiddleware(root)` (shared with the Vite dev plugin), everything else is
served as a static file from the built `dist/app`, falling back to `index.html` for
unknown paths (SPA client-side routing). `paper-camp dev` calls this against
`process.cwd()`.

**Rationale:** No new runtime dependency, no duplicated parsing/serving logic between dev
and the installed CLI. Verified by building the package, running `dist/cli/index.js dev`
in a fresh temp project, and confirming the served HTML/JS/CSS/font assets, `/api/plans`
and `/api/config` reflecting that project's own data (not this repo's), and the SPA
fallback all work — plus a headless-browser screenshot of the Plans page rendering real
data from the built bundle.

## Commit messages use type(scope): description, scope is the plan number

**Date:** 2026-06-27
**Status:** decided

**Context:** Wanted a clearer commit convention tying commits back to the
plan/idea they belong to, e.g. `feat(20): description` instead of bare
`feat: description`. Testing the new rule against this repo's actual commit
history (all `feat: Title Case Description`) surfaced that
`@commitlint/config-conventional`'s default `subject-case` rule rejects
capitalized subjects — every prior commit would fail the `consistency` CI
check the first time it ran for real.

**Decision:** `.commitlintrc.json` now requires a non-empty scope
(`scope-empty: [2, "never"]`). Scope convention: the plan/idea number alone,
no kind prefix (`feat(22)`, not `feat(feat-22)` or `feat(FEAT-22)`) — the
`type` already encodes the kind. Commits not tied to a plan use a short area
name as scope instead (`chore(deps)`). `subject-case` is disabled
(`[2, "never", []]`) to keep the repo's existing capitalized-subject style
valid rather than forcing every future commit into lowercase-imperative.

**Rationale:** A bare number scope is shorter than repeating the kind twice
(`feat(feat-22)` is redundant since `type` is already `feat`), and mirrors how
PR titles already display `FEAT-22: Title`. Disabling `subject-case` avoids a
style fight with three years of existing commit history just to satisfy a
linter default that was never actually enforced before this plan added a real
`consistency` check.

## Branch protection on main requires checks but stays push-friendly

**Date:** 2026-06-27
**Status:** decided

**Context:** Auditing FEAT-22 found `main` had zero branch protection on the
live GitHub repo — `gh api repos/.../branches/main/protection` returned 404.
A broken commit could merge through a PR with no CI gate at all, despite
`ci.yml` defining three checks. The "main stays pushable" decision (above)
meant any protection rule had to keep direct pushes working.

**Decision:** Applied branch protection to `main` via `gh api` requiring the
`Quality`, `Tests`, and `Consistency` status checks to pass before a PR can
merge (`required_status_checks.contexts`), with `enforce_admins: false` and no
push restrictions. `NPM_TOKEN` was deliberately *not* set by the agent — it's
a secret value belonging to the user's npm account, not something to generate
or transmit through tool calls.

**Rationale:** Required status checks gate the PR merge button only — they do
not block direct `git push` to a protected branch, so this is compatible with
agents/users pushing small fixes straight to `main`. `enforce_admins: false`
keeps that escape hatch explicit rather than accidental.

## Per-feature branch workflow

**Date:** 2026-06-27
**Status:** decided

**Context:** FEAT-22 phase 4 adopts a per-feature branch workflow to replace
the current every-commit-goes-to-main pattern. This required decisions on
branch naming, PR creation timing, whether `main` stays directly pushable, and
how the branch workflow affects IDEA-4's agents that write directly to
`plans.md`/`progress.md`.

**Decision:**
- **Branch naming:** `<kind>/<lowercase-id>-<kebab-title>` — exactly one branch
  per plan, named after its plan ID and short title. Examples:
  `feat/feat-22-ci-cd-automation`, `fix/fix-2-review-status-bugs`.
- **PR creation:** On the first push to a feature branch, a GitHub Action
  (`draft-pr.yml`) creates a **draft** PR automatically. Idempotent: skips if
  a PR already exists for that branch.
- **Main stays pushable.** Direct pushes to `main` are allowed for: agent
  writes to `plans.md`/`progress.md` during phase execution, tiny fixes, and
  config changes. All substantive plan work uses branches merged via PR.
- **IDEA-4 agents are unaffected.** Agents write to `plans.md`/`progress.md`
  on whatever branch is checked out. When running on a feature branch, those
  writes travel with the branch and merge into `main` along with the rest of
  the work. Merge conflicts from two branches editing overlapping regions of
  `plans.md` are possible but accepted — IDEA-20 (per-file plans) will
  eliminate this structurally.

**Rationale:**
- The double-prefix branch format (`feat/feat-22-...`) is redundant but
  self-documenting in a plain `git branch` listing — the plan ID is always
  visually present without needing to know the scheme.
- Draft PRs give CI feedback from the first push without forcing a "ready for
  review" state. The PR is the workspace; promoting it to ready is the human
  signal that review should happen.
- Main stays pushable because the solo workflow has legitimate use cases for
  direct-to-main commits (agent progress writes, hotfixes). `main` does have
  branch protection (added later — see "Branch protection on main requires
  checks but stays push-friendly" above), but it only gates the PR merge
  button via required status checks; it does not restrict direct pushes. The
  convention itself (when to push to `main` vs. open a PR) is enforced by
  code review, not a CI gate.
- The per-branch agent impact is minimal because IDEA-4's agents already write
  to the working tree regardless of branch. No agent behavioral change is
  needed — just awareness that branch context matters for where writes land.

**Context:** IDEA-4 originally scoped "one active task at a time" as a v1 limitation,
to be revisited once concurrent tasks were needed. FEAT-18 introduced a third agent-task
kind (idea-extension, alongside FEAT-10's phase execution and FEAT-17's plan-drafting),
which raised the question of whether `agent.ts`'s single `current: AgentTask | null`
slot should become concurrent now that there's more than one kind of task.

**Decision:** No — `agent.ts` keeps exactly one running task at a time, regardless of
kind. FEAT-18's phase 5 ("Broaden the Stack panel's Agent section beyond phase
execution") is display-only: generalize the Agent card to render any task kind
sensibly, without touching the underlying one-task concurrency model.

**Rationale:** Concurrent tasks mean a shared workspace with possibly conflicting edits
to the same `papercamp/` files — a much bigger problem than rendering a second task kind
in the UI, and not one that's been asked for. More task *kinds* existing doesn't by
itself create a need for more task *slots*.
