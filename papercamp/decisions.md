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
**Status:** decided

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

## Agent tasks stay one-at-a-time even with multiple task kinds

**Date:** 2026-06-27
**Status:** decided

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
