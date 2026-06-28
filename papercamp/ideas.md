### IDEA-1: Project docs browser

A Docs page that aggregates all project documentation into a browsable, searchable view inside the dashboard, so the project's full narrative — structure, conventions, decisions — is one click away instead of scattered across the terminal and editor. The papercamp/ folder is the living memory; the Docs page is the reference library built on top of it.

The most concrete, lowest-effort slice of this already half-exists: `parseDecisions` and `parseOpenQuestions` (`src/core/parser.ts`) and the `/api/decisions`/`/api/open-questions`/`/api/progress` routes (`src/app/server/api.ts`) are fully built and tested, but no page in the dashboard fetches them — they're dead endpoints right now. A Docs page is the natural home for the UI that's been missing all along.

Feature ideas, roughly in build order:

- **Decisions log view** — render `decisions.md` as a real list of ADRs: title, `Stamp` for `decided`/`superseded`, date, and the prose body (Context/Decision/Rationale). A `superseded` entry links forward to whatever replaced it via `Superseded-by`.
- **Open questions view** — render `open-questions.md` the same way: `Stamp` for `open`/`resolved`, and a `resolved`-entry links to the `decisions.md` entry that answered it via `Resolved-by`. Open questions are the most actionable thing in `papercamp/` that currently has zero visibility outside the raw file.
- **Cross-linking between the two** — since a decision's "Resolved-by" and a question's "Resolved-by" already reference each other by title, turn those into real in-app links (click a resolved question, land on the deciding decision, and vice versa) instead of just rendering the prose.
- **Progress timeline** — a simple reverse-chronological feed of `progress.md`'s `## YYYY-MM-DD` sections. Could stand alone, or merge with decision dates into one combined "project history" feed.
- **Repo docs section** — a second grouping, separate from the structured `papercamp/` records above, for the general markdown floating around the repo root (`README.md`, `CHANGELOG.md`, `LICENSE`) and any others that show up later (e.g. a `docs/` folder, `CONTRIBUTING.md`). Plain markdown rendering, no parsing into fields — same "read-only, no schema" treatment `ideas.md` already gets.
- **Search** — one search box, full-text across everything above (decisions, open questions, progress entries, repo docs), jumping straight to the matching section.
- **Navigation** — a left sidebar grouped by source ("Decisions", "Open Questions", "Progress", "Repo Docs"), same shape as the existing `PlansSidebar`.

Why this one first: the backend is already done and tested. This is UI work on top of an existing, working API surface, not a new subsystem.

---

### IDEA-2: Settings page and configs

Turn Settings from a single static info+icon page into a real sidebar-driven configuration workspace — but scoped honestly to what *this* repo's stack actually has, not a generic eslint/prettier list. The existing project-info card (name, version, icon — already built) becomes the sidebar's default "General" section rather than the whole page.

**Shipped (FEAT-5), confirmed against the current code:**

- **Sidebar layout** — `settings-sidebar.tsx` mirrors `PlansSidebar`'s structure: a left rail of sections (`General`, `Config Files`), main area showing whichever one is selected. "General" is the default landing section.
- **Auto-discovered config sections, not a hardcoded list** — `GET /api/configs` (`src/app/server/api.ts`) checks a fixed candidate list (`biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`) against what actually exists in the repo root and returns only the hits — the sidebar never shows a config this repo doesn't have.

**Also shipped (FEAT-9):**

- **Structured rendering for `package.json`** — `ConfigEditorSection` special-cases it into a `name → command` table instead of a raw `CodeBlock`; every other allowlisted config still renders as `CodeBlock`.
- **Editable project identity** — the "General" card's project name is now an editable `Input`, saved through `POST /api/config`.

This idea is fully shipped — no open items remain.

**Scope change (2026-06-25): the write path for `biome.json`/`tsconfig.json`/etc. is dropped, not deferred.** The original plan for the remaining half was a `Textarea` + JSON-validate + allowlisted save endpoint over these files directly. On reflection that solves a problem nobody has — they're real editor/LSP-backed files; a save button in a browser textarea is strictly worse than the editor already open in another window, for the exact same edit. What's actually worth making *editable* through this dashboard is a small, curated set of operational settings common to most repos (dev server port, env vars) — split out into [[IDEA-13]] rather than bolted onto this idea's original "make every config writable" framing.

---

### IDEA-3: The Stack panel

A persistent right-hand panel, present across every page (not a route — more like the `NavigationIsland`, but docked right and full-height), showing the active plan and a feed of recent project activity. Default open, toggleable closed.

**Look:** styled directly after paper-ui's showcase `DetailSidebar` (`src/showcase/components/detail-sidebar.tsx` in the `paper-ui` sibling repo) — the closest existing thing to "chalkboard style, full height" already built. Concretely: `position: fixed`, pinned `right`, `top: 0` to `bottom: 0`, slides in/out via `transform: translateX(...)` with a transition (not a width animation), dark chalkboard texture (`textures.ts`'s `chalkboard` — `#142e22` base + turbulence, paired with the desk-green gradient the showcase panel uses), a `Luminari`-font header with a close/toggle control, and `Caveat`-cursive uppercase labels for each content section. `Card`, `Stamp`, and `CodeBlock` all already support a `variant="chalkboard"` — log entries and status badges inside the panel should use those directly rather than inventing new dark-mode styling.

**Feature ideas, roughly in build order:**

- **Idle state — activity history** — when nothing's in progress, show a reverse-chronological log. The data already exists and is unused: `progress.md` + `/api/progress` (parsed, tested, zero consumers today — same gap the Docs page idea found). Could share a "progress feed" component with the Docs page's progress timeline, just rendered once in light theme (Docs) and once in chalkboard (here).
- **Active state — "what's in progress now"** — surface the currently in-progress plan, reusing the same `findFocusPlan` resolution logic Focus already has, plus its phase progress.
- **Live activity feed, sourced from file changes** — the honest signal for "what's happening" beyond static plan status is changes to the `papercamp/` files themselves. A file watcher (`fs.watch` or `chokidar`) on the dev server, diffing each file's previously-parsed entries against the newly-parsed ones, can synthesize human-readable lines ("phase 2/5 checked off in 'X'", "plan 'Y' marked done", "new open question raised") without inventing a new schema — it's narrating diffs of files that are already the source of truth.
- **Delivery mechanism** — the dev server is currently a plain `node:http` server with only request/response, no push. An SSE endpoint (`GET /api/activity/stream`, kept open, one event per detected change) is the smallest real-time addition Node's `http` module supports natively, no new dependency. Polling `/api/progress`/`/api/plans` on an interval and diffing client-side is the fallback if SSE turns out to be more plumbing than it's worth for a first version.

This whole idea is buildable from data and patterns that already exist in the codebase — no new concept of "an agent" required, just a live view of the same plan/progress state the rest of the dashboard already shows.

---

### IDEA-4: Agent orchestration

A more concrete shape for what started as "agent observability." Clicking a plan/task in the dashboard launches a real agent session scoped to that task, streams a simplified view of its progress into the status panel ("The Stack" idea above), and lets you send follow-up input into the same session without leaving the browser. This turns Paper Camp from a passive viewer of `papercamp/` into an active layer between you and the agent — but the persisted record stays exactly where it already lives, in `plans.md`/`progress.md`, written by the agent itself as part of doing the work, not in some new log format.

Built for more than one agent from the start — Claude Code for most work, something lighter like opencode for small tasks — rather than hardwiring to one tool and bolting on a second later.

**The core mechanism, roughly in build order:**

- **Launch, through a thin per-agent adapter** — a "Start" action hands the task's prompt to whichever agent is selected, through a small shared interface: `launch(prompt, options) → stream of events`, `resume(sessionId, message) → stream`, plus capability flags (e.g. `supportsResume`). A Claude Code adapter would spawn `claude -p "<prompt>" --output-format stream-json` (or use the Claude Agent SDK directly, if CLI-output parsing turns out too brittle); an opencode adapter does the equivalent against its own CLI/API. Each adapter's only job is normalizing its agent's output into the same event shape — the orchestration logic, status-collapsing, and UI underneath don't know or care which agent is running. The prompt itself is built the same way the existing Focus page's "copy AI handoff prompt" button already constructs its text — this is the natural next step for that feature, not a new one.
- **Choosing an agent** — a default lives in `.paper-camp/config.json` (machine config, not project narrative — the same file that already holds the icon and project name), with an optional per-task override via a new `Agent:` field on a `plans.md` entry, following the same pattern as the existing optional `Tags`/`Updated` fields. That override is exactly the workflow described: route small or routine tasks to a lighter/cheaper agent while keeping bigger work on the default. The Settings idea's sidebar (once built) is the natural place to set the project default.
- **System-prompt instruction instead of a new schema** — whichever agent is launched is told, as part of its prompt, to keep doing what any session in this project already would: append meaningful checkpoints to `progress.md`, check off tasks in `plans.md` as they're done. This is what resolves the file-diff-vs-dedicated-log tension from the previous version of this idea — the agent's own writes *are* the activity log, in the schema that already exists. No second source of truth, and it holds regardless of which agent wrote it.
- **Live status, kept ephemeral** — the raw stream of tool-use events (Read/Edit/Bash/etc.) gets collapsed server-side into one-line, human-readable status text ("Editing `src/foo.ts`", "Running `pnpm test`", "Reading codebase…") and pushed to the status panel over the same SSE channel "The Stack" idea already proposed. Shown only while a task is running, never written to disk — "something's happening and roughly what," not a transcript.
- **Steering mid-task** — for agents whose adapter supports it (Claude Code does, via `--resume`/`--continue`), the dashboard holds onto the running task's session id, and anything typed into the panel's input gets sent as a new turn into that same session rather than starting a new one. This is the part that actually makes it "a layer between you and the agent," not just a fire-and-forget launcher.
- **Completion** — when the process exits, the panel returns to its idle/history state, now showing the fresh `progress.md` entries the session itself just wrote.

**Decisions worth making explicit before this gets scoped into a plan, not discovered mid-build:**

- **Verify each agent's adapter against the real thing before writing it — don't assume Claude Code's specifics generalize.** Its headless `stream-json` output shape and `--resume`/`--continue` session semantics are known; opencode's equivalent scriptable/headless invocation, output format, and whether it supports resuming a session at all still need to be checked against its actual current CLI/API, not assumed by analogy.
- **Capability flags, not silent failure.** If an agent's adapter can't support mid-task resume (or any other capability), the dashboard should visibly disable that control for sessions on that agent rather than pretend it works.
- **One active task at a time for v1, regardless of agent.** Concurrent tasks means a shared workspace with possibly conflicting edits — a much bigger problem than the launch/steer loop itself, not worth solving before that loop works for a single agent.
- **Process lifecycle is independent of the browser tab.** A running agent is a real, possibly long, shell-capable process — it should keep running if the dashboard tab closes; the SSE stream is just a subscription to it, not what keeps it alive.
- **Strictly localhost.** A button that launches a shell-capable agent session is one of the more sensitive things a local tool can expose, whichever agent it is. Fine with no auth bound to `127.0.0.1` (same trust model as running any of these CLIs directly), but this is the one feature that should never grow a "remote access" option without real auth behind it.
- **Uses whichever agent's session/quota is selected** — worth surfacing in the UI somewhere obvious, since each launched task is real usage against that agent's own plan/credits, same as running it manually.

---

### IDEA-5: Repo health status

A third section in the already-built Stack panel (`src/app/components/stack-panel.tsx`), next to "Active" and "Live", showing whether the repo is actually green right now — lint, format, and tests — without opening a terminal. This is the concrete version of a promise the original pitch already made ("analog gauges display project health and momentum") rather than a new concept: three small status pills wired to checks the project already runs by hand.

No new tooling — it wraps the scripts already in `package.json`: `biome check .` (covers both lint and format in one pass, since this repo uses Biome instead of separate ESLint/Prettier) and `vitest run` for tests.

**Look:** a "Status" section using the panel's existing `sectionLabelStyle`, placed at the very top of the panel, above "Active" — it's the most "at a glance" of the panel's sections. (The "Commit section in The Stack" idea below adds a second top-of-panel section; final top-to-bottom order ends up Status → Commit → Active → Live.) Three `Stamp` pills (`variant="chalkboard"`, same component already used elsewhere in the panel/showcase), labeled "Lint", "Format", "Tests", each in one of four states: `pass` (green), `fail` (red), `running` (amber, pulsing), `stale`/`unknown` (gray — shown before the first check has ever run). Clicking a `fail` pill expands a `CodeBlock` (`variant="chalkboard"`) inline beneath it with the raw error output — biome's own error list for lint/format, vitest's failed-test summary for tests — so the failure detail lives in the same panel, no tab-switching to a terminal.

**Feature ideas, roughly in build order:**

- **Backend status cache** — a small in-memory store on the dev server (sits next to `createActivityManager` in `src/app/server/activity.ts`, or a sibling module) holding `{ lint: CheckResult, format: CheckResult, test: CheckResult }`, where `CheckResult` is `{ status: 'pass' | 'fail' | 'running' | 'stale', lastRun: string | null, output: string }`. Starts as all `stale` on server boot.
- **`GET /api/status`** — new route in `src/app/server/api.ts` returning the current cache as-is (no run triggered), same shape as the other read routes (`/api/plans`, `/api/progress`, etc.).
- **Lint/format — auto, on file change** — `biome check .` is near-instant, so it's safe to run on every relevant file change. Reuses whatever file watcher the existing "Live activity feed" item (see "The Stack" idea above) ends up using for `papercamp/` — extend it to also watch `src/`, debounced ~500ms, and spawn `biome check .` on settle. Push the result as a new SSE event type over the *existing* `/api/activity/stream` channel (`activity.ts` already has the pub/sub; this just adds a second event shape, not a second stream) instead of building a parallel connection.
- **Tests — manual first, auto later if it proves worth it** — `vitest run` is too slow/costly to fire on every keystroke. Start with a "Run tests" button inside the Status section (`POST /api/status/test`, triggers a one-off `vitest run`, streams `running` → `pass`/`fail` over the same SSE channel). Only graduate to auto-run (e.g. on a longer debounce, or cached by a hash of `src/**`/`tests/**` so unchanged code skips a re-run entirely) once the manual version shows people actually want it live.
- **In-flight guard** — track a single boolean per check ("lint/format running" / "test running") so a burst of file saves can't spawn overlapping `biome`/`vitest` child processes; a change that arrives mid-run just queues one more run after the current one finishes, instead of stacking processes.
- **Strictly localhost, repo-root-only** — same trust note as the "Agent orchestration" idea above: this spawns real child processes (`biome`, `vitest`), always against the fixed project root the dev server already knows, never a user-supplied path. Fine for a tool that only binds to `127.0.0.1`, but worth keeping explicit as the one boundary not to relax.

Why this is a natural next step rather than a new subsystem: it's the same SSE plumbing the Stack panel's activity feed already needs, pointed at `biome`/`vitest` exit codes instead of `papercamp/` file diffs — no new infrastructure, just a second source feeding the same pipe.

---

### IDEA-6: Plan and phase IDs

Right now a `PlanEntry`'s `title` (`src/types/index.ts`) doubles as both the identifier and the full description — entries like "Build core library: parser, schemas, scaffold, CLI" or "Add board view, plan CRUD, and project branding" are sentence-length, and every place that lists plans (`plan-card.tsx`, `plan-nav-item.tsx`, `kanban-card.tsx`, `plans-sidebar.tsx`) renders that whole sentence. Same problem one level down: a `PhaseItem` (`src/types/index.ts`) is just `{ done, text }`, and `text` is itself a full sentence ("Add AI focus handoff — one-line copy-prompt per phase with plan title and phase number") rendered inline in `plan-detail.tsx` with no way to collapse it. This idea gives both plans and phases a short, scannable identity, with the long version still available but tucked behind a click.

**ID scheme:**

- Every plan gets a permanent ID of the form `<TYPE>-<N>` — `FEAT-2`, `FIX-9`, `CHORE-3` — assigned once at creation and never reused, even if the plan is later deleted. `TYPE` is the uppercased `Kind` field on the plan entry, and `Kind`'s values are spelled exactly like Conventional Commits' own type strings (`feat | fix | chore | docs | refactor`, not "feature") — on purpose, so the ID prefix, the `Kind` field, and the commit `type:` that closes it out are the same word in three places, not three near-matching spellings.
- **Numbering must be a persistent counter, not "scan plans.md and take the highest + 1."** Plans get deleted (there's already a `DELETE /api/plans` route), and a scan-based scheme would silently reassign a freed number to a new, unrelated plan — which breaks the entire point of an ID meant to be searchable in git history. Store `nextId: { feat: number, fix: number, ... }` in `.paper-camp/config.json` (the same file that already holds the icon and project name) and increment it server-side on every plan creation, never derive it from the current file contents.
- Ideas get the same treatment, one level up: `IDEA-N`, assigned in the order they're written into `ideas.md`, rendered as a heading prefix (`### IDEA-9: Plan & phase IDs — ...`, this very entry would be the next number). This is what makes a plan → idea backlink (next point) possible — without a stable idea ID, "this plan came from that idea" has nothing durable to point at.
- A plan entry gains an optional `**Idea:** IDEA-9` field (same pattern as the existing optional `Tags`/`Updated` fields in `src/core/parser.ts`/`serializer.ts`), rendered in the UI as a small clickable badge next to the plan's ID that jumps to the originating section of the Docs page's ideas view (see the "Project docs browser" idea above) or `ideas.md` itself. Not every plan needs one — plenty of past entries here (e.g. "Refresh about.md technical reference") were never an idea first.

**Short titles, long bodies:**

- The `title` field becomes a true short headline (2–6 words: "Parser & CLI scaffold" instead of "Build core library: parser, schemas, scaffold, CLI"). Anything lost from the old long-form title moves into the existing `body` field, which already exists separately from `title` and already holds a paragraph of context for most entries — this is a rewording pass on existing data, not a new field.
- Everywhere a plan is listed, render `<Stamp>{id}</Stamp> {shortTitle}` instead of the bare long title — sidebar, board columns, cards, and the `plan-detail.tsx` header.

**Phase numbering + accordion:**

- Phase number is computed, not stored — just `index + 1` over `plan.phases`, so phases always renumber correctly when one is added, removed, or reordered. No markdown change needed for this part.
- `PhaseItem` gains an optional `description?: string` alongside the existing `text` (renamed to read as the short title). Markdown encoding: the checkbox line stays exactly as today (`- [x] Short phase title`), and an optional indented paragraph on the following line(s) becomes the long description:
  ```
  - [x] Parser with non-fatal warnings
        Handles malformed `### Phases` blocks without throwing — collects a ParseWarning
        instead, so one bad entry doesn't take down parsing for the whole file.
  ```
  `extractPhases` in `src/core/parser.ts` needs to grab indented continuation lines following a checkbox item and join them into `description`, leaving phases with no continuation exactly as they parse today (`description: undefined`) — fully backward-compatible with every phase already written in `papercamp/plans.md`.
  - **A paper-ui `Accordion` component, which doesn't exist yet** (checked `~/dev/paper-ui/src/components` — there's `card`, `code-block`, `tabs`, etc., but no expand/collapse primitive). Needs building first: single-item expand/collapse, chevron or `+`/`–` affordance, height-animated via the same `framer-motion` pattern already used in `stack-panel.tsx`'s `AnimatePresence`, with the usual `variant`/`size` props so it slots into both the light Plans page and a future chalkboard context. In `plan-detail.tsx`, each phase row only gets the accordion's expand control if `description` is present — phases with just a short title (the common case for everything written before this lands) render exactly as they do today, no empty disclosure arrow.

**Commitlint alignment:**

- There's no commitlint/husky setup in this repo today (checked `package.json`, no `@commitlint/*` deps, no `.husky/`). Add `@commitlint/cli` + `@commitlint/config-conventional`, enforcing the same `feat|fix|chore|docs|refactor|...` type vocabulary the plan `Kind` field uses — so a plan's ID and the commit type that closes it are the same word, not two parallel taxonomies that can drift apart.
- Nice-to-have, not required for v1: a custom commitlint rule (or just a convention, enforced by habit/AI prompt rather than tooling) nudging commit messages to include a `Refs: FEAT-2` footer line, so `git log --grep "FEAT-2"` finds every commit tied to a given plan — the actual payoff the user is after ("a ready-made number to search the history by").

**Decisions worth making explicit:**

- **IDs are permanent — deleting a plan retires its number, it does not free it.** This is the one correctness property the whole scheme depends on; get the counter-storage decision above wrong and IDs stop being trustworthy as a history-search key.
- **`Kind` is optional during migration.** Existing `papercamp/plans.md` entries have no `Kind`/ID today; they should render with no ID badge rather than forcing a backfill pass before this can ship. New plans get a `Kind` going forward (prompted at creation, alongside the existing `Status`/`Tags`).
- **Where `Kind` is set:** at creation time only (the "Add idea" modal / `POST /api/plans`), same lifecycle moment as the ID assignment — not editable after the fact, since changing a plan's type after its ID was already referenced in commit history would make that history lie.

---

### IDEA-7: Commit section

A second top-of-panel section in the Stack panel (`src/app/components/stack-panel.tsx`), sitting right below "Status" (see the "Repo health status" idea above — final order ends up Status → Commit → Active → Live). Shows the live working-tree diff — how many files changed and which ones — plus a small form to write a commit title/message and fire it off, so a commit doesn't require switching to a terminal.

This pairs naturally with two ideas already in this file: it's fed by the same file-watcher/SSE plumbing "Status" needs, and it's the natural place to cash in the `Kind`/ID scheme from "Plan & phase IDs" — pre-filling the commit's conventional-commit type from whatever plan is currently in focus.

**Look:** a changed-files count (`"7 files changed"`) as the section's headline, expanding via the same paper-ui `Accordion` the phase-description idea above needs to be built anyway — each row showing a path and its git status letter (`M`/`A`/`D`/`??`) with a checkbox to include/exclude it from the commit. Below that, a title `Input` and a message `Textarea`, then a `Button` labeled "Commit", disabled whenever zero files are checked or the title is empty.

**Feature ideas, roughly in build order:**

- **`GET /api/git/status`** — new route in `src/app/server/api.ts` that runs `git status --porcelain=v1` from the repo root and parses it into `{ path: string, status: string }[]`. Pushed over the existing `/api/activity/stream` SSE channel on the same debounced file-watcher trigger the "Status" idea already needs — "files changed" is exactly the signal that watcher is already positioned to recompute.
- **`POST /api/git/commit`** — body `{ files: string[], title: string, message?: string }`. Runs `git add -- <files>` against *only* the explicit paths in the request (never a blanket `git add -A`/`-u`) — same "write path only accepts an allowlisted/explicit set, never an arbitrary blob" principle the Settings idea's config-save endpoint already follows — then `git commit -m "<title>" -m "<message>"`.
- **Real git hooks fire for free** — since the commit happens as an actual `git commit` subprocess (not a reimplementation), a `commit-msg` hook from commitlint+husky (once the previous idea's commitlint piece lands) rejects a malformed message exactly as it would from the terminal — surfaced back to the UI as an inline `Alert` with the hook's own error text, no client-side validation logic to keep in sync with it.
- **Smart pre-fill from the active plan** — if `findFocusPlan` resolves a single in-progress plan, pre-fill the title field with that plan's `Kind` as a conventional-commit prefix (`feat: `, `fix: `) and offer a one-click "add `Refs: FEAT-2`" footer — turning the ID scheme from the previous idea into something that actually shows up in `git log`, not just in `plans.md`.

**Decisions worth making explicit:**

- **Commit only — no Push button, on purpose.** Committing is local and reversible; pushing touches shared/remote state and shouldn't be one click away in a panel that's open by default on every page. If push ever gets added, it should be its own deliberate, separately-confirmed action, not a checkbox on this form.
- **Don't hard-block commits when "Status" is red.** Failing tests/lint shouldn't disable the Commit button outright — plenty of legitimate commits are WIP or a deliberate checkpoint mid-fix. Show a non-blocking `Alert` next to the button when Status is failing (same spirit as GitHub showing a failing-check badge without blocking the merge button by default), rather than this panel unilaterally deciding what counts as "clean enough to commit."
- **Same localhost/repo-root boundary as every other child-process-spawning idea in this panel** — `git status`/`git add`/`git commit` always run against the fixed project root the dev server already knows, never a path from the request.

---

### IDEA-8: Ideas board

Today every `ideas.md` section renders flat in a single "Ideas" grid (`list-view.tsx`'s `ideaEntries.map(...)` → `IdeaCard`), as a long, un-prioritized, un-titled blob of prose per card. Nothing distinguishes a brand-new idea from one that shipped months ago, nothing says which one matters more, and the card title is whatever the first line of prose happens to be — for several of the entries already in this file, that's a full sentence. This replaces the flat grid with a real two-column board: **Planned** and **Done**.

**Idea entries need real structure, the same way plans/decisions/open-questions already have it.** Right now `ideas.md` is parsed client-side by a one-off `parseIdeas` in `src/app/stores/app-store.ts`, splitting on `---` and grabbing the first heading line as `title` — it's the only one of the four `papercamp/` files not going through the shared `src/core/parser.ts`/`src/types/index.ts` layer. This is the moment to fix that: give ideas a real `IdeaEntry` type (`id`, `title`, `body`) and a `parseIdeas` in `core/parser.ts` alongside `parseDecisions`/`parseOpenQuestions`, parsing a heading shaped `### IDEA-7: Short title` (the `IDEA-N` prefix from the "Plan & phase IDs" idea above, now load-bearing rather than decorative).

**Short titles, same rule as plans:** the heading becomes a true short title (3–6 words), not the current sentence-length headings — several already in this file need a rewrite pass once this lands (e.g. "Repo health status — live lint/format/test results in The Stack" → "Repo health status"). Whatever context that's lost from the long heading already lives in the body prose below it; nothing new needs writing, just trimming the heading.

**Priority is positional, not a stored number.** No `**Priority:** 3` field gets added — that would be one more piece of state to keep in sync by hand. Priority *is* the order ideas appear in `ideas.md`, top to bottom; reordering priority means reordering the sections in the file. The board shows ideas within each column in that same source order (highest priority first), optionally with a small rank number for readability, but the number is read off position, never set independently of it. A "move up"/"move down" control (swapping two adjacent sections' order in the file via a small write endpoint) is a fine v2 — v1 can ship fully read-only, since reordering by hand-editing the file works today and isn't blocked on any UI.

**Planned vs. Done, derived exactly as the previous version of this idea specified:** an idea is "Done" only when *every* plan linking to it (via the plan's `**Idea:** IDEA-7` field) has `Status: done` or `dropped` — checking all linked plans, not just one, so a partially-realized idea stays in "Planned." Everything else (including ideas with zero linked plans yet) is "Planned." Still nothing stored on the idea side for this — same "derive, don't duplicate" reasoning as before.

**Idea ↔ plan linking is asymmetric, matching how the data actually works:** a plan has exactly one `Idea` field (a plan grows out of at most one idea), but an idea can have many plans pointing at it (one idea, several plans built against it over time) — this is already the natural shape once the plan side stores the link and the idea side only ever derives its plans by scanning for matches, no change needed to make the cardinality work, just confirming it. Each idea row, when expanded, lists every plan that links to it as a clickable `Stamp` per plan ID (`FEAT-2`, `FIX-9`, ...) — the same plan→idea link already proposed, just rendered from the other direction.

**Look:** two columns side by side, reusing `kanban-column.tsx`'s column shell from the existing Board view (`board-view.tsx`) rather than inventing new column chrome — header + count, vertical list of rows. Each row: a small icon (the existing `LightbulbIcon` for "Planned", a checkmark icon for "Done"), the short title, and — on expand/click — the list of linked plan `Stamp`s described above. This sits where the current "Ideas" grid section lives in `list-view.tsx`, or could reasonably become its own small view if the two-column layout doesn't fit naturally inside the existing list/board toggle.

**Decisions worth making explicit:**

- **Hard dependency on the Idea-ID backlink field** from "Plan & phase IDs" above — none of Planned/Done, priority order, or the plan-link list work without it; don't start this before that field exists.
- **Migrating existing ideas.md entries** — the file's five current entries (as of this session) need a one-time pass to add `IDEA-N:` prefixes and shorten their headings; not a blocking schema migration (old unprefixed headings can render with no ID badge), but worth doing in the same pass so the board doesn't launch with half its cards missing IDs.
- **Read-only priority for v1** — explicitly deferring drag-to-reorder/up-down controls until the simpler "priority = file order" version proves the column layout itself is right.

---

### IDEA-9: Review status

Two real gaps found while reading `plan-detail.tsx` and `closed-section.tsx` just now, both pointing at the same underlying problem: once a plan is marked complete, you lose visibility into it.

- `plan-detail.tsx`'s `handleMarkDone` jumps straight from "all phases checked" to `Status: done` — there's no human checkpoint in between. The "Mark complete" button fires the instant `allDone` is true.
- `closed-section.tsx` renders closed/dropped plans with `<PlanCard plan={p} />` and **no `onOpen` prop** — `PlanCard` only renders its "Open" button `if (onOpen)`, and the card's outer `div` has no click handler either (unlike `IdeaCard`, which does). So a closed plan in list view is genuinely unopenable today — confirmed by reading the component, not a guess.

**A new `review` status closes the first gap:** `PlanStatus` gains `review`, sitting between `in-progress` and `done`. The transition into it is automatic, not a button: `handleTogglePhase` already recomputes `allDone` on every toggle — when checking a phase makes it true, the same call sets `status: 'review'` instead of leaving it `in-progress`, no separate "Submit for review" click required. The "Mark complete" button disappears entirely; completing the last phase *is* the submission. A plan in `review` gets two manual outcomes: **"Approve & close"** (`status: 'done'`) or **"Needs changes"** (`status: 'in-progress'`, sent back — and since phases are already all checked at that point, reopening one of them is what naturally drops `allDone` back to `false`, so there's no separate "uncheck everything" step). Phase checkmarks otherwise survive every transition untouched — whatever's wrong belongs in the Log (below), not in mass-unchecking boxes.

**Where it lives in the layout — a dedicated Review page, not a new column or section.** Board view and List view keep their current shape: `KANBAN_COLUMNS` stays `planned` / `in-progress` (no third column), and `list-view.tsx`'s section filters stay as they are (no new "Review" section between "In progress" and "Backlog"). A plan that flips to `review` simply stays wherever it already renders — bucketed with `in-progress` for board/list purposes — and gets called out with a small `Stamp` reading "Review" next to its `PlanIdStamp` on `KanbanCard` and `PlanCard`, reusing the same `Stamp`/`STATUS_STAMP` pattern already used for tags and IDs. That's the only change to the existing board/list components.

The actual review workflow — "Approve & close" / "Needs changes", and the Log below — lives on a **new top-level Review page**, structured like the Plans page: its own route (`/review`) and nav item in `router.tsx`'s `navItems`, its own sidebar branch in `RootLayout`, and a list filtered to `status === 'review'` across all plans, each opening into the same plan-detail view used elsewhere. This gives review a dedicated place to work from — a "what's waiting on me" queue — without retrofitting the Board/List filters to carry a status they don't otherwise need to display as a column.

**Fix `closed-section.tsx`:** pass the same `onOpen` prop `list-view.tsx` already wires up for the active/backlog `PlanCard`s. This alone restores the ability to open a closed or dropped plan and read what's in it — independent of everything else in this idea, and worth doing regardless.

**A per-plan Log, available on every plan, not just ones in review:** a new `### Log` sub-section in the plan's markdown block, parsed the same way `### Phases` already is — extending `src/core/parser.ts`'s existing heading-block extraction rather than writing a second one-off parser for it — formatted as dated bullets that deliberately mirror `progress.md`'s own `## YYYY-MM-DD` / `- item` shape, just scoped to one plan instead of the whole project:
```
### Log
- 2026-06-21: Implemented the persistent ID counter in `.paper-camp/config.json`.
- 2026-06-22: Review — counter logic looks solid; one missing migration note, fixed.
```
Rendered in `plan-detail.tsx` below the phases list, with a small `Textarea` + "Add entry" button appending a new dated line via a `PATCH /api/plans` extension. No second write target needed for the Stack panel's "Live" feed either — it already narrates diffs between the previous and current parsed `plans.md`, so a new Log line shows up there automatically the same way a checked-off phase already does, with zero new plumbing.

**Decisions worth making explicit:**

- **Phase checkmarks survive "Needs changes."** Reopening a plan doesn't reset progress — what needs fixing gets written as a new Log entry, not represented by un-ticking a box that was honestly completed.
- **Log entries are manual-only for v1.** An AI agent appending its own checkpoints there instead of (or alongside) `progress.md` is a natural extension once the "Agent orchestration" idea's "write checkpoints as you go" convention exists, but isn't required to ship this.

---

### IDEA-10: Plan clarification pass

Three ideas below (this one, "Phase convergence audit", and "Plan/decision consistency check") came out of looking at how GitHub's `spec-kit` and similar spec-driven tools structure the AI's side of planning — not to adopt their per-feature folder pipeline (`about.md` already rejected that ceremony on purpose), but because a few of their individual mechanisms are genuinely portable onto the plan record shape this project already has.

Right now a plan goes from `idea` to `planned` with whatever ambiguity was in the original prose — nothing forces a pass over scope, edge cases, or non-functional constraints before phases get written. `spec-kit`'s `/clarify` command's actual algorithm (not just its existence) is worth borrowing directly: scan against a fixed taxonomy (functional scope, data model, UX flow, non-functional attributes, edge cases, terminology, completion signals), surface at most 5 of the highest-impact gaps, and ask **one question at a time**, each with a stated recommendation up front (`**Recommended:** Option A — <why>`) so the default answer is just "yes." This turns an open-ended "anything unclear?" into a bounded, low-effort loop.

**Where it lives — a new optional `### Clarifications` sub-section per plan**, parsed the same way `### Phases` and `### Log` already are. `extractLog` (`src/core/parser.ts:99-102`) and `extractPhases` (`src/core/parser.ts:79-82`) both already go through the generic `extractSection` helper (`parser.ts:22-44`); this needs the same treatment, not a new one-off parser:

- Generalize `extractLog`'s body into an `extractDatedList(body, headingRe)` helper, since a clarification entry and a `LogEntry` are the same shape (`{ date, text }`) — `LOG_ENTRY_RE`'s `^-\s+(\d{4}-\d{2}-\d{2}):\s*(.*)$` pattern works unchanged for `- 2026-06-25: Q: <question> → A: <answer>` lines.
- Add `CLARIFICATIONS_HEADING_RE = /^###\s+Clarifications\s*$/i` and call the generalized helper with it, same as `extractPhases`/`extractLog` do with their own heading regexes.
- `PlanEntry` gains `clarifications?: LogEntry[]`, reusing the existing `LogEntry` type from `src/types/index.ts` — no new type needed.

**Where the taxonomy/loop logic lives — a static prompt, not new app logic.** The existing "AI focus handoff" pattern (`PhaseCopyButton`, `src/app/features/plans/components/phase-copy-button.tsx:41`) is a one-line template (`Start phase ${phaseIndex + 1} of plan "${planTitle}"...`) copied to the clipboard. This idea needs the same mechanism — a button on `plan-detail.tsx`, e.g. "Clarify before starting" — but with a longer fixed prompt constant (the taxonomy + the "ask one at a time, lead with a recommendation, write accepted answers back under `### Clarifications`" instructions), since one line can't carry it. Worth a small `src/app/features/plans/prompts.ts` once there's more than one of these — this idea plus "Phase convergence audit" below both need a prompt constant longer than `PhaseCopyButton`'s current inline template literal.

**Rendering**: a read-only list below the plan body, above Phases, styled identically to how `### Log` entries already render in `plan-detail.tsx` (dated bullets) — this is presented context, not something edited directly in the UI; corrections happen by re-running the clarify prompt or hand-editing the markdown.

**Decisions worth making explicit:**

- **No session grouping, unlike `spec-kit`'s `### Session YYYY-MM-DD` subheadings.** Each clarification entry already carries its own date via the reused `LogEntry`/`LOG_ENTRY_RE` shape; grouping multiple same-day answers under a second heading level is ceremony this project's "no numbering scheme, no status tables" stance (`about.md`) doesn't need.
- **Trigger point is `idea`/`planned` → about to start, not enforced.** Nothing blocks moving a plan to `in-progress` without a clarification pass — it's an available tool for plans worth the 5-question overhead, not a gate every plan must pass through.

---

### IDEA-11: Phase convergence audit

The companion to "The Stack" panel's existing phase-progress view and to "Plan clarification pass" above: once a plan has phases and work is underway, nothing currently re-checks whether the phase list still matches what the code actually needs. A phase written before implementation started can easily miss something that only became obvious once the work began.

`spec-kit`'s `/converge` command's mechanism is exactly the missing piece, and it's a particularly cheap one to borrow because its core discipline is a write constraint, not new logic: compare the plan's intent against the current code, and **append** any newly-discovered remaining work as new phase items at the bottom of `### Phases` — never reorder, check, uncheck, or rewrite an existing phase. If nothing's missing, it changes nothing at all, not even an empty heading.

**This needs zero parser or schema changes.** `parsePhaseEntries` (`src/core/parser.ts:46-77`) already round-trips an arbitrary list of `- [ ]`/`- [x]` lines with optional indented descriptions; appending new unchecked items to that list is just... writing more lines in the same format a human already writes by hand. The entire feature is a UI affordance plus a prompt:

- A button on `plan-detail.tsx`, next to the existing phase list — "Audit phases against code" — alongside `PhaseCopyButton`.
- A fixed prompt (same `prompts.ts` home suggested in the clarification idea above) instructing the agent: read this plan's phases and body, inspect the current repo state, and append any phase that's clearly required but missing — each as a normal `- [ ]` line, optionally with the existing indented-description format `parsePhaseEntries` already supports — at the end of the list. Explicitly never touch existing lines, checked or not. Finish by appending one line to `### Log` (the field IDEA-9 already added) summarizing what was found, e.g. `- 2026-06-25: Convergence audit — appended 2 phases (missing error-state handling, missing test coverage).` — for free, since the Stack panel's "Live" feed already narrates diffs against `plans.md`, including `### Log` additions (per IDEA-3's design).
- If the audit finds nothing missing, the prompt should say so and write nothing — matching `/converge`'s "byte-for-byte unchanged" guarantee, which is what makes the audit safe to re-run anytime without it becoming log spam.

**Decisions worth making explicit:**

- **Append-only is the entire safety property.** The value of this idea over just asking the AI "what's left?" in chat is specifically that it can never silently mark something done or reorder a phase someone's relying on the position of — that constraint belongs in the prompt text itself, stated explicitly, not left implicit.
- **No new UI for reviewing what got appended beyond the existing phase list and Log entry.** The appended phases show up exactly where any other phase would, in `plan-detail.tsx`'s normal list; this isn't a diff viewer, just a disciplined writer.

---

### IDEA-12: Plan/decision consistency check

`decisions.md` and `open-questions.md` are the two files in `papercamp/` that exist specifically to stop a project from re-litigating settled questions or losing track of blockers — but nothing today checks whether they're internally consistent, or whether an unresolved open question is actually blocking work that's marked `in-progress` anyway. `spec-kit`'s `/analyze` command runs exactly this kind of check across its own artifacts (spec/plan/tasks): a read-only, severity-graded findings pass, never a write. The equivalent here is small enough to be entirely derivable from data already parsed — no AI call needed for v1, same "derive, don't duplicate" approach `deriveIdeaStatuses` (`src/core/parser.ts:253-265`) already uses for Idea status.

**Checks worth running, all pure functions over already-parsed entries:**

- **Dangling cross-references** — an `OpenQuestionEntry.resolvedBy` (`src/types/index.ts:67`) or `DecisionEntry.supersededBy` (`types/index.ts:59`) whose value doesn't match any actual entry title. These links are currently rendered as clickable (per IDEA-1's "Cross-linking between the two"), so a typo'd or stale title silently produces a dead link today with nothing surfacing it.
- **Open questions blocking active work** — needs one new optional field to express the link honestly: `OpenQuestionEntry` gains `blocks?: string` (a plan `id`, e.g. `FEAT-2`), parsed and serialized the same way the existing optional `Idea:` field on `PlanEntry` already is. A finding fires when a question with a `Blocks:` field is still `open` while that plan's `status` is `in-progress` or `review` — surfaced as "open question is blocking active work," the single most useful flag this idea produces.
- **Orphaned `decided` decisions** *(stretch, not required for v1)* — a decision with no plan ever referencing it isn't necessarily wrong (plenty of decisions are about process, not a specific feature), so this is a weaker signal than the two above; worth deferring until the two structural checks prove useful on their own.

**Where it renders** — as a fourth pill in the Stack panel's existing "Status" section (IDEA-5: `src/app/components/stack-panel.tsx`), next to Lint/Format/Tests, labeled "Consistency." States: `clean` (no findings) or a count (`"2 issues"`), same `Stamp` component, same click-to-expand pattern the lint/format pills already use for showing failure detail — except the expanded content here is a short list of findings (one line each, e.g. "Open question 'Should plans support sub-tasks?' blocks FEAT-7 (in-progress)"), each clickable through to the Docs page's decision/open-question view (IDEA-1) or the blocking plan itself. Reuses the panel's existing disclosure affordance rather than inventing a new one.

**Decisions worth making explicit:**

- **No AI involved in v1.** Every check above is a structural join over fields that already exist or are trivial additions — `spec-kit`'s `/analyze` does ambiguity/duplication detection that genuinely needs an LLM; the highest-value findings for this project's actual data shape don't.
- **`Blocks:` is optional and asymmetric, matching how `Idea:` already works** — a plan doesn't need to know which questions block it; the open question declares the dependency, the same direction `Idea:` already points (plan → idea, not idea → plan).
- **Read-only, same as `/analyze`.** This never edits `decisions.md`/`open-questions.md`/`plans.md` — it's a lint pass over docs, surfaced where the existing lint/format/test pills already live, not a new write path.

---

### IDEA-13: Project settings — port & env vars

Replaces the "editable raw contents" ambition [[IDEA-2]] originally had for `biome.json`/`tsconfig.json`/etc. Those are real editor/LSP-backed files — a write path over them adds nothing. What's actually worth editing through this dashboard is the small set of operational knobs that are genuinely common across most repos, not specific to this stack: which port the dev server binds to, and which env vars are set.

This repo's own state makes the gap concrete. The port `3333` is hardcoded in three separate places with nothing tying them together: `package.json`'s `dev` script (`--port 3333`), `vite.app.config.ts`'s `server.port`, and the default on `src/cli/index.ts:41`'s `-p, --port` CLI flag for the published `paper-camp dev` command. None of them are visible in the dashboard, and there's no single place that's the source of truth. Env vars are the opposite problem: this repo has no `.env` file at all today, despite that being the single most universal mechanism across JS projects for exactly this kind of config — the feature needs to ship generic, not against a file that happens to exist here.

**Port:**

- New optional `port?: number` field on `PaperCampConfig` (`src/types/index.ts:85-90`), alongside the existing `version`/`projectName`/`initializedAt`/`nextId`.
- A number `Input` in the Settings "General" section, saved through a new `POST /api/config` — this endpoint doesn't exist yet (`GET /api/config` at `src/app/server/api.ts:100-105` is read-only); building it once also closes `IDEA-2`'s still-open "editable project name" item, since both are just different fields on the same `.paper-camp/config.json`.
- **Honest framing, stated in the UI itself**: this sets the default for the *next* launch, not a live port switch on the server that's currently running — same as changing `--port` on a CLI invocation. Nothing about editing this field should imply the dashboard you're looking at right now will hop ports.
- Stretch, not required for v1: wire `src/cli/index.ts:41`'s default to read this value (falling back to `3333` only if unset), so the config field is an actual source of truth instead of a number nothing downstream consumes.

**Env vars:**

- A new `GET`/`POST /api/env` pair, reading/writing the project root's `.env` file directly — not folded into `.paper-camp/config.json`, since `.env` is the format the rest of the ecosystem (including this repo's own Vite setup, if it ever needs one) already expects.
- Parse into `{ key, value }[]`, rendered as a table. Values whose key matches `KEY`/`SECRET`/`TOKEN`/`PASSWORD` (best-effort substring match, not a security boundary) render masked by default with a click-to-reveal; everything else renders plain.
- Add/edit/delete rows; write back as a normal `KEY=value` file, preserving comment lines and the ordering of every line not touched — a one-field edit shouldn't reformat the whole file.
- **The actual highest-value piece**: if a `.env.example` exists, diff its keys against `.env` and flag any present in the example but missing from the real file. "Which env var did I forget to set after pulling" is the recurring problem this solves — editing a value that's already there without opening a text file is a much smaller win by comparison.
- Auto-discovery, same rule the existing `GET /api/configs` list already follows (`api.ts:119-137`) — the section simply doesn't render when neither `.env` nor `.env.example` exists, same as a tool config that isn't present today.

**Where it lives**: a new section in the Settings sidebar, separate from the existing read-only "Config Files" section — these are knobs paper-camp itself manages, not a viewer over someone else's tool config.

**Decisions worth making explicit:**

- **Write paths stay allowlisted and explicit, same principle as every other write path in this codebase** (the Commit section's explicit-files-only `git add`, the existing config-name allowlist) — `/api/env` and `/api/config` only ever touch their one fixed file each, never an arbitrary path from the request.
- **Masking env values is a UX nicety, not a security control.** The dev server has no auth and is already assumed localhost-only everywhere else in this file; this doesn't change that boundary, it just avoids splashing a secret across the screen by default.
- **Not a generalized "config editor."** This idea exists because port and env vars are the actual instances of "config most repos need to change" — it's deliberately not a reusable framework for editing arbitrary files, which is exactly the scope `IDEA-2`'s original write-path ambition overreached into.

---

### IDEA-14: Review-found phases

A `/code-review` pass against a plan's implementation surfaces real findings (bugs, cleanup, conventions violations) that today only exist as chat output — nothing persists them, and nothing lets you act on one with a click the way [[IDEA-4]]'s "Start agent" button already lets you act on a planned phase.

The first design considered was a separate `bugs`/`updates` entity type, parallel to plans, linked back to the plan it was found against (the same shape `ideas.md` already uses for idea→plan links). Rejected as overbuilt: it means a new markdown file, its own parser/schema/serializer support, a new sidebar section, and a duplicate of the per-phase "Start agent" wiring [[IDEA-4]] already built and tested — all to express something that's structurally just "another unit of work on this plan."

**Simpler shape: review findings become new, unchecked phases appended to the plan they were reviewed against.** This gets the existing per-phase machinery for free — the "Start agent" button, the running-phase spinner, the post-run "did it actually check off the box" verification — with zero new infrastructure. The only real gap: a review-found phase needs to read as *not originally planned* at a glance, so it doesn't look like scope the user wrote themselves.

**Marking, roughly:**

- `PhaseItem` gets an optional `source` field (e.g. `source?: 'review'`), parsed from a small inline tag on the phase's checkbox line in `plans.md` (e.g. `- [ ] [review] <finding summary>`) rather than a separate markdown section — keeps phases as one list, ordered however they were added, instead of two competing lists to reconcile.
- In the Phases table (`plan-detail.tsx`), a review-found phase gets a small `Stamp`/badge next to its title (mirroring how tags already render) and a slightly different row background so it reads as distinct without a second table or section.
- **Open implementation gap, not yet decided:** paper-ui's `Table` has no per-row styling hook today — only per-cell `cell` render functions. Giving a row its own background means either adding a small generic `rowClassName?: (row, index) => string` prop to paper-ui's `Table` (a real, if small, addition to the shared sibling repo, not just a paper-camp change) or finding a paper-camp-only way to fake it from inside a cell. Worth resolving deliberately when this gets built, not mid-flight.
- The finding's `failure_scenario`/file:line detail from the review (already produced today by `/code-review`'s JSON output) becomes the phase's `description` — same field that already renders in the expandable row for ordinary phases.

**Decisions worth making explicit:**

- **One plan, one phase list — review findings are not a parallel track.** This avoids the "which list is authoritative" question a separate entity type would raise, at the cost of phases no longer being purely "things planned in advance."
- **Marking is cosmetic/informational, not a different lifecycle.** A review-found phase still goes through the exact same checkbox/Status-honesty rules ([AGENTS.md](../AGENTS.md)'s "update the plan as you go") as any other phase — it just looks different.

---

### IDEA-15: Agent-drafted plans

Turning an idea into an actual plan is the one step in this whole pipeline still done entirely by hand — write a title, break it into phases, fill in descriptions. Everything downstream of that (executing a phase, reviewing the result) already has a "Start agent" button per [[IDEA-4]]. This idea closes the gap on the front end: a button on an `IdeaEntry` that launches an agent whose job is to read the idea and draft a real, phased plan from it.

**Why this is a different shape of agent task, not just a new button.** [[IDEA-4]]'s agent is scoped to *executing* one phase of an existing plan — the prompt says "do this, then check it off." This agent's job is the opposite end of the pipeline: read `ideas.md`'s prose for one `IDEA-N`, plus whatever `about.md`/`decisions.md` context is relevant, and produce a new `plans.md` entry — title, phases, descriptions, `idea: IDEA-N` backlink — with nothing yet built. `src/app/server/agent.ts`'s current `AgentTask` is implicitly phase-shaped (`planId` + `phaseIndex`); a planning task has neither, since the plan doesn't exist until the agent writes it. The two task shapes likely share the spawn/stream/stop machinery in `agent.ts` but need a second prompt-builder and a different "what does success look like" check than [[IDEA-4]]'s phase-checkbox verification — probably "did a new `## Heading` with `idea: IDEA-N` actually appear in `plans.md`."

**Where the button lives:** the `IdeasBoard` row (`about.md`'s description: lightbulb/check icon, title, expand-to-linked-plans) gets a "Draft plan" action, available while the idea has no linked plan yet — once a plan exists for an idea, this button's job is done and the existing per-phase buttons take over.

**Priority and ordering are decided, not open:** `plans.md` has no `Priority:` field, and doesn't need one — `ideas.md` already establishes "priority = file order" for ideas (`about.md`/the Ideas-board plan's "Order ideas by file position" phase). This agent follows the same convention for plans: the prompt includes every other non-`done` plan as context, and the agent's job is to insert the new plan at the file position that reflects where it belongs in implementation order, not append it at the end. If reviewing the open set shows the new plan should jump ahead of (or behind) existing open plans, the agent **may reorder those existing entries' position too** — but only moves headings, never edits another plan's title, phases, or body text. This keeps the blast radius to "where things sit in the file," matching the read-only-content guarantee the rest of this pipeline already relies on.

**Make that order visible, not just inferable.** Unlike the Ideas board (which actually renders `ideaEntries` top-to-bottom in file order, so position doubles as a visible ranking), the Plans page's "Backlog" section is the wrong shape for this today — per `about.md`, plans render grouped by status with no indication that file order means anything. A user staring at the Backlog list has no way to tell the agent's chosen order from an arbitrary one. This idea should also add a small ordinal marker (e.g. "1.", "2." or a numbered `Stamp`) to each `PlanCard` within the Backlog section, reflecting its file position — read-only for v1, same as the Ideas board's ordering is read-only with no drag-and-drop. Without this, the whole priority-setting half of this idea produces an effect nobody can see.

**Resolved:** the agent writes `plans.md` directly, no separate approval step — same as [[IDEA-4]]'s phase-execution agent. The new entry lands at `Status: idea` in the Backlog, where the existing CRUD (edit, delete, promote) is the review surface. See `decisions.md`'s "Plan-drafting agent writes plans.md directly, same as phase execution".

**Open questions, not yet decided:**

- **How much of `papercamp/` does the prompt need as context** to draft a plan that fits this project's actual conventions (phase granularity, the `kind`/`id` scheme, linking back via `idea`) instead of generic boilerplate — the whole of `about.md`, or something smaller and more targeted?
- **Relationship to [[IDEA-14]]:** both are "agent produces a planning artifact, not a code change" — if [[IDEA-14]]'s phase-marking generalizes into a real non-execution task type in `agent.ts`, this idea is the second consumer of that same generalization rather than its own special case.

---

### IDEA-16: Ideas UX improvement

A grab-bag of UX fixes for the Ideas/Stack flow, flagged from actually using the app rather than from a single feature gap.

- **Hide completed ideas from the sidebar.** The sidebar currently lists every `IdeaEntry` regardless of status; once an idea has a linked plan that's `done`, it should drop out of the default list rather than sitting alongside the still-open ones.
- **Simpler idea-creation form.** Replace however ideas get created today with a plain form: `title` + `body`, nothing else — matching the minimal shape `ideas.md` entries actually need to start.
- **"Extend with AI" button on an idea.** Inside an open idea, a button that launches an agent task to explore the current codebase/features and rewrite the idea's body into something more specific (concrete approaches, file references) based on the user's original input — same agent-task machinery [[IDEA-4]]/[[IDEA-15]] already use, just scoped to rewriting one idea's prose instead of drafting a plan or executing a phase.
- **Visual feedback is missing across the board.** Several recently-shipped features (buttons, agent actions) give no indication anything happened — no loading state, no success/failure confirmation. Every user-triggered action needs visible feedback for its in-flight and completed states, not just a correct end result; this is a recurring gap to watch for in future phases, not a one-off fix.
- **Agent section in Stack should show all agent activity, not just the active plan's phase.** Today "Agent" in the Stack panel only reflects [[IDEA-4]]'s one-task-at-a-time phase execution. It should surface agent work more broadly — including tasks like [[IDEA-15]]'s plan-drafting or this idea's "Extend with AI" — not just plan-phase runs, and the underlying one-task-at-a-time constraint ([[IDEA-4]]'s "one active task at a time for v1" decision) is worth revisiting once more than one kind of agent task exists.
- **Cap the Ideas board's Done column at 4 visible rows.** Show only the 4 most-recently-done ideas; a 5th row reads "[N more ideas]" as a link instead of a card, where `N` is the remaining done count. Clicking it navigates to a separate done-ideas list view showing the full set.

---

### IDEA-17: opencode agent support

Today `src/app/server/agents/index.ts` only registers one adapter (`claude-code`), and `.paper-camp/config.json`'s `defaultAgent` is a single project-wide value used for every kind of agent task. This idea adds a second real adapter (opencode) and lets the default be set per task kind instead of one global value, plus fixes visual problems on the Settings page noticed while looking at where this config lives.

- **Add an opencode `AgentAdapter`.** A second entry in `AGENTS` (`src/app/server/agents/index.ts`) alongside `claude-code` — its own `command`, `buildArgs`, `parseLine`, and `capabilities` (in particular whether it supports `--resume`-style mid-task steering, per [[IDEA-4]]'s "verify each adapter against the real thing, don't assume Claude Code's specifics generalize"). `AGENT_IDS`/`AGENT_LABELS` (`src/types/index.ts`) gain `'opencode'`.
- **Make opencode the default for phase-execution tasks.** Per the user's request, the new agent becomes the default for running plan phases specifically (FEAT-10's task shape) — not necessarily for every task kind, which is why per-task-kind defaults (next bullet) matter rather than one blanket `defaultAgent`.
- **Per-task-kind agent selection in Settings, not one global default.** There are now three agent-task shapes — phase execution ([[IDEA-4]]), plan-drafting ([[IDEA-15]]), idea-extension ([[IDEA-16]]'s "Extend with AI") — and `config.json`'s `defaultAgent` currently applies to all of them as one value. Replace it with a small per-kind mapping (e.g. `defaultAgents: { phase: AgentId, planDraft: AgentId, ideaExtend: AgentId }`) and a Settings control per kind instead of one `Select`. A plan's own per-plan `Agent:` override (already supported for phase execution) still wins over whichever default applies to that kind.
- **Fix Settings page visual issues — confirmed live at `http://deimos:3333/settings` (screenshots taken via Claude in Chrome).** Two concrete problems in `settings-page.tsx`'s `GeneralSection`:
  - Every single-input row (Project Name, Project Icon, Dev Server Port, Default Agent) is its own full-width `Card` with `marginTop: space[8]` above it, each holding just one field + one Save button — four near-identical cards stacked with large gaps between them, pushing the page well past one screen for what's a handful of related project settings. Group these into one card (or a tighter list-style layout, e.g. one `Card` with internal dividers per row) instead of one card per field.
  - Confirmed: the Default Agent `Select` is rendered inside its `Card`, and `Card`'s own stylesheet sets `overflow: hidden` (`~/dev/paper-ui/src/components/card/card.module.scss:6`) — so when the dropdown opens, its option list renders *underneath* the "Used to launch agent sessions…" helper text and gets hard-clipped flush at the card's bottom edge; with only one agent today (`Claude Code`) the single option row is already half cut off, and adding `opencode` as a second option makes it fully unreachable by mouse since it'd render entirely below the clipped boundary. Fix needs to either render the dropdown in a portal (escaping the Card's overflow context entirely — check whether paper-ui's `Select` already supports this or needs the change made there) or restructure so `Select` controls don't sit inside an `overflow: hidden` container.
  - The new per-task-kind agent selectors from the previous bullet should be built with this fixed layout/dropdown behavior from the start, not added on top of the current cramped, clipped one — otherwise there'd be three more `Select`s with the same bug instead of one.

---

### IDEA-18: GitHub integration

This repo (`git@github.com:croco-dendy/paper-camp.git`) has zero `.github/` workflows today — no CI runs `tsc`/`biome`/`vitest` on a push or PR, there's no automated `npm publish`, and every commit so far has gone straight to `main`. One piece of groundwork already exists, unused: `.commitlintrc.json` enforces Conventional Commits with a `type-enum` restricted to exactly this repo's own plan `Kind` values (`feat`/`fix`/`chore`/`docs`/`refactor`) — but nothing currently runs it (no `.husky` commit-msg hook, no CI lint job), so it's effectively dead config. This idea wires up real CI/CD around what's already there rather than starting from scratch.

- **CI workflow for tests and quality checks.** A `.github/workflows/ci.yml` running on push/PR: `pnpm install`, then `pnpm run check-types`, `pnpm run lint`, `pnpm test` (the same three commands every phase in this project's own `progress.md` log already runs by hand before calling a change done). Should also enforce `.commitlintrc.json` against the PR's commits (`commitlint --from <base> --to <head>`), finally giving that config a real job instead of sitting unused.
- **Automate npm publishing.** `package.json` has no `publishConfig` and nothing automates bumping `version`/tagging/`npm publish` today — every release would currently be done by hand. Needs a workflow triggered on a version tag (or merge to `main`, depending on the versioning approach below) that runs `pnpm run build` and `npm publish`, using an `NPM_TOKEN` repo secret.
- **Automated versioning/changelog: `release-please`.** Considered three real options against this repo's existing conventions rather than guessing — `semantic-release` (releases immediately on every qualifying push, no human checkpoint), `changesets` (explicit per-PR changeset files instead of parsing commits — adds an authoring step this repo's workflow doesn't have today), and `release-please` (Google's tool: parses Conventional Commits the same way semantic-release does, but instead of publishing immediately it maintains a standing, auto-updated **release PR** with the bumped `package.json` version and generated `CHANGELOG.md` — nothing actually releases until that PR is merged, which is what triggers the GitHub Release/tag).
  - **Picked `release-please`.** This repo commits straight to `main` today with zero review gate — release-please gives one deliberate "ship this version" checkpoint (merging the release PR) without forcing full PR-per-commit review onto regular feature work, and the release PR it maintains is itself a real PR, dovetailing with the PR-automation bullet below rather than competing with it.
  - Same caveat as the other two tools: release-please's `changelog-sections` config controls what's *shown* in the changelog, not what bumps the version — version-bump eligibility still follows the Angular convention (`feat`→minor, `fix`→patch) by default, so `refactor`/`chore`/`docs` won't trigger a release unless explicitly configured to. Given how much of this repo's real work is `refactor`, decide explicitly whether `refactor` should bump patch before wiring this up — don't inherit the default silently.
  - **Commit convention to pair with it:** keep the existing Conventional Commits header (`<type>: <subject>`, already validated by `.commitlintrc.json`) plus the Stack panel's existing "Add Refs: FEAT-N" trailer convention (`commitTitle`/`addRefs` in `stack-panel.tsx` already produces `Refs: FEAT-17`-style trailers) — release-please only reads the header type for versioning, so the `Refs:` trailer stays pure traceability back to `plans.md`, same role it already plays today.
- **Automate PR creation per feature.** Today everything is committed straight to `main` (confirmed via `git log` — no merge commits, no branches in history). Moving to "one PR per plan/feature" needs: a branch-naming convention tied to this repo's own `Id` scheme (e.g. `feat/feat-19-plan-clarification-pass`, matching `plans.md`'s `FEAT-N`/`FIX-N` ids), and something that opens the PR — either a thin wrapper around `gh pr create` invoked at the point a plan's phases are all done (mirroring how [[IDEA-4]]'s agent already writes `progress.md`/`plans.md` checkpoints as it works — a PR description built the same way, summarizing the plan's `### Log` entries), or a GitHub Action triggered on push to a `feat/*`/`fix/*` branch. Needs a real decision on *when* a PR opens (every phase? only when a plan reaches `review`?) before this is buildable — flagging as open, not assuming.
- **Open questions worth resolving before scoping a plan, not guessing:**
  - Does adopting PR-per-feature change anything about [[IDEA-4]]'s agent writing directly to `plans.md`/`progress.md` on `main` today? If agents now work on feature branches, the append-only/log-as-you-go conventions need to still make sense per-branch, not just on `main`.
  - Is `main` ever meant to be protected (required CI pass before merge) once PRs exist, or does direct-push-to-`main` stay allowed for solo iteration? Affects whether the CI workflow is purely informational or a real merge gate.

---

### IDEA-19: Resolve open questions from the Docs page

`open-questions.md`'s Docs view (`open-question-detail.tsx`) is read-only today — it shows the question, its `open`/`resolved` `Stamp`, and a click-through to whatever `decisions.md` entry resolved it, but there's no way to actually answer one from the app. Right now the only path is dictating an answer in chat and having it hand-written into `decisions.md`; this idea closes that gap with a real in-app action.

- **The serializer half of this is already written and just sitting unused.** `src/core/serializer.ts` has `formatDecisionEntry`/`formatOpenQuestionEntry` and the generic `appendBlock` helper, but nothing in `src/app/server/api.ts` ever calls them — `grep` for either name turns up zero call sites outside `serializer.ts` itself. They were evidently written ahead of a route that never got built. This idea is mostly about wiring up what already exists, not designing new serialization.
- **"Resolve" action on `OpenQuestionDetail`** (`src/app/features/docs/components/open-question-detail.tsx`), gated on `question.status === 'open'` (same conditional that currently guards nothing — there's no action in this component today, just the read-only header/Stamp/body at lines 22-68). A `Button` opens a `Modal`, following `src/app/components/add-idea-modal.tsx`'s exact shape (controlled `open`/`onClose`/`onAdd` props, `Input`/`Textarea`/`Button` from `@dendelion/paper-ui`, a local `loading` state, reset-on-open via `useEffect`). Fields: a short **Decision** line (becomes both the new `decisions.md` heading and the `Resolved-by` value — `decisions.md`'s existing headings already read as one-line decision statements, e.g. "Drop the `./app` JS export; dist/app is static-only", so no separate "title" field is needed) and an optional **Rationale** textarea. **Context** is not collected — it's `question.body`, already on screen.
- **New endpoint, following this codebase's existing route style.** Every route in `api.ts` is a flat pathname with method + query-string params (`PATCH /api/plans?title=...`, `DELETE /api/plans?title=...`) — none use path params like `/:title`. Match that: `POST /api/open-questions/resolve?title=<question title>` with a JSON body `{ decision: string, rationale?: string }`. The handler does both writes before responding:
  1. `formatDecisionEntry({ title: decision, date: todayDateString(), status: 'decided', body: <Context/Decision/Rationale prose, Context pulled from the question's own body> })` through `appendBlock(campFile(root, 'decisions.md'), entry)` — both already exist, finally get a caller.
  2. Flip the matching `open-questions.md` entry: `parseOpenQuestions` the file, map the entry whose `title` matches the query param to `{ ...entry, status: 'resolved', resolvedBy: decision }`, then write the whole file back. There's no plural `formatOpenQuestions` yet (unlike `formatPlans`, which `PATCH /api/plans` already uses for exactly this read-map-rewrite pattern at `api.ts`'s plan-PATCH handler) — add one, mirroring `formatPlanEntry`'s per-entry join in `formatPlans`.
  - Order matters for `findConsistencyIssues` (`src/core/parser.ts:276`), which already flags `dangling-resolved-by` whenever an open question's `Resolved-by` doesn't match a real decision title: write the decision first, then flip the question, so a crash between the two steps never leaves a `resolved` question pointing at a decision that doesn't exist yet.
- **Frontend wiring:** add a `resolveOpenQuestion(title, decision, rationale?)` function to `src/app/services/docs-api.ts` (currently only has `fetch*` reads). On success, re-call the store's existing `loadDecisions`/`loadOpenQuestions` (`src/app/stores/app-store.ts`) to refresh both lists — the same "refetch after a mutating call" pattern the Stack panel's activity feed already uses to keep `loadPlans`/`loadProgress` in sync.
- **Reverse link already built, for free.** `DecisionDetail` (`src/app/features/docs/components/decision-detail.tsx:16`) already computes `resolvedQuestions = openQuestions.filter((q) => q.resolvedBy === decision.title)` and renders a "Resolves ..." line back to the question(s) it answers — that's the back-link `about.md` calls for, and it needs zero changes once the new decision's heading matches what `Resolved-by` was set to.
- **Why this is worth a dedicated idea, not a quick fix:** even with the serializer half pre-built, it's a real cross-file write with an invariant `findConsistencyIssues` already polices (every `resolved` question must point at a real decision heading) — the same class of problem [[IDEA-1]]'s original decisions/open-questions cross-linking solved for *reading*, just needs the write side built now that there's demand for it (this conversation hit the exact gap firsthand: an open question raised mid-chat with no faster way to answer it than dictating prose).

---

### IDEA-20: Plan storage architecture

`plans.md` is one monolithic file holding every plan ever created, `done` or not — already 1045 lines / 23 of 26 plans closed, and it only grows. At this project's actual stated goal — many plans/fixes over time, managed mostly by AI agents working sequentially or on branches — a single growing file becomes expensive in three concrete ways: every agent read costs the whole file even when it cares about one plan, the hand-rolled line parser (`core/parser.ts`, which already emits non-fatal warnings on malformed entries) gets more fragile the more entries it has to scan, and two branches editing two different plans still collide on the same file's line ranges. `ideas.md` has the identical shape and will hit the identical wall.

**Core change: one file per plan/idea, not one file per project — and one visible folder, not two.** This also folds in dropping `.paper-camp/` (config/assets) into the now-restructured `papercamp/`, since the directory restructure is the natural moment to fix that too:

```
papercamp/
├── about.md              # technical reference — stays one file, prose
├── decisions.md           # decision log — stays one file, append-only
├── open-questions.md      # open questions — stays one file, append-only-ish
├── progress.md             # changelog — stays one file, append-only timeline
├── config.json             # moved from .paper-camp/ — machine config (nextId counters, defaultAgent, port, projectName)
├── assets/
│   └── icon.svg             # moved from .paper-camp/assets/
├── plans/
│   ├── index.md              # generated — id/title/status/tags only, never hand-edited
│   ├── feat-17.md             # YAML frontmatter (id/status/kind/tags/dates/idea/agent) + body (description/phases/log)
│   ├── feat-20.md
│   ├── fix-3.md
│   └── archive/
│       ├── feat-1.md           # moved here verbatim once Status → done/dropped, no rewrite
│       └── feat-2.md
└── ideas/
    ├── index.md                # generated — id/title only
    ├── idea-1.md
    └── idea-17.md
```

`about.md`/`decisions.md`/`open-questions.md`/`progress.md` stay exactly where they are, untouched — they're read as a log/reference, not scanned for "what's active," so the per-file/bloat argument doesn't apply to them. `archive/` sits inside `plans/`, not as a sibling, since a closed plan is still conceptually a plan, just inactive; `ideas/` gets no equivalent archive folder since ideas don't "close" the same way a plan does (a done idea just has a linked done plan — the idea entry's own shape doesn't change).

This alone fixes the cross-branch conflict problem structurally (two branches touching two different plans now touch two different files, not two regions of one file) and means an agent working `FEAT-734` reads exactly one small file, not one file with 999 other plans in it.

**Metadata format: YAML frontmatter instead of `**Field:** value` lines.** The current format mixes typed metadata (`Status`, `Kind`, `Id`, `Tags`, dates) with prose (description, phases, log) inside one ad-hoc line-based grammar — workable at 26 entries, but it's exactly the kind of format that gets more error-prone to hand-parse as volume grows. Move the typed fields into a `---`-delimited YAML frontmatter block at the top of each file (same pattern Jekyll/Hugo/Obsidian/Astro use for "structured fields + free prose, one file per record"), parsed with a real YAML parser feeding straight into the existing zod schemas (`core/schemas.ts`) instead of a hand-rolled line grammar. The markdown body below frontmatter stays exactly as today — phases as a `- [ ]`/`- [x]` checklist (already about as unambiguous as text gets, no reason to touch it), description and log as prose.

**Spec stays generated, not hand-duplicated.** Today the field list is documented twice — in `about.md`'s prose and in the zod schemas — which is exactly the kind of drift that's easy to miss at 26 entries and likely at 1000. Generate the frontmatter spec from the zod schema (e.g. via `zod-to-json-schema`) so there's one source of truth an agent (or `about.md` itself) can read off directly.

**Fast overview without reopening the bloat problem: a generated index.** A small `papercamp/plans/index.md` (or `.json`) — id, title, status, tags only, no bodies — regenerated on every write, is what the dashboard's list view and an agent's first "what's going on here" pass actually read, instead of either scanning every per-plan file or reintroducing one big file by accident.

**Archiving becomes a file move, not a rewrite.** A plan moving to `done`/`dropped` just moves from `papercamp/plans/` to `papercamp/plans/archive/` (or similar) — no parse-and-re-serialize step, unlike the earlier "cut from one file, append to another" version of this idea. `progress.md` and `decisions.md` are explicitly **not** part of this change — they're read as a timeline/decision log, not scanned for current state, so the bloat argument doesn't apply to them the same way.

**This is a real migration, not a config flag.** `core/parser.ts`/`schemas.ts`/`serializer.ts` need to operate on a directory of frontmatter files instead of one line-parsed file; every CLI command (`init`, `add plan`) and dashboard API route that currently reads/writes `plans.md`/`ideas.md` whole needs updating to the new per-file model; and existing content needs a one-time migration script splitting the current monolithic files into the new layout.

**Why drop `.paper-camp/` rather than move everything under it.** Today there are two top-level folders — `papercamp/` ("the project's memory, versioned, human + AI readable" per `about.md`) and `.paper-camp/` ("local config, not the memory": `config.json` + icon assets) — which is its own source of confusion. `about.md`'s own framing is that the memory content is meant to be opened and read directly; folding it behind a dotfolder convention (the same one `.git/`/`.vscode/` use, which most editors and file browsers collapse by default) works against that on purpose-built content, for no real gain since the config/icon data isn't sensitive enough to need hiding. Hence config/assets move *into* the visible `papercamp/`, not the other way around.

**Open questions, not yet decided:**
- **Filename convention** — pure id (`feat-17.md`) or id+slug (`feat-17-agent-drafted-plans.md`)? The former is stable across renames; the latter is more readable in a plain directory listing.
- **Does `ideas.md` actually need this yet?** It's smaller and grows slower than `plans.md` — worth confirming the same threshold problem actually applies before migrating it on the same timeline rather than assuming parity.

---

### IDEA-21: Batch plan-doc freshness audit

The existing "Phase convergence audit" (`AuditPhasesButton`, see `plans.md`'s "Phase convergence audit" section) already solves this for one plan at a time: an AI pass that compares a single plan's recorded phases against the actual code and append-only adds whatever's missing, never rewriting or checking off existing lines. What's missing is the sweep version — going through every `review`/`done` plan and surfacing drift across the whole project in one pass, instead of remembering to click audit on each plan individually.

**Shape:** reuse the same convergence-audit prompt and append-only guarantee, just looped over every closed/closing plan instead of one. Two plausible entry points, not mutually exclusive:

- A CLI command (`paper-camp audit` or similar) that iterates `plans.md`'s `review`/`done` entries, runs the existing audit logic against each, and prints a combined report of which plans got new gap-phases appended.
- An "Audit all" button in the dashboard (Plans list or Stack panel) doing the same, surfaced as activity feed entries per plan touched.

**Why not a CI job:** each plan costs one real AI call, so running this on every push would be slow and burn tokens auditing plans that haven't changed since their last audit. Better triggered manually on a cadence (weekly, or before a release/`Approve & close` sweep) than wired into `ci.yml`.

**Open question:** how to avoid re-auditing plans that haven't changed since their last clean audit — likely needs a per-plan "last audited" marker (a log line, or a field) so a full sweep skips anything untouched since.
- **Should the generated index double as [[IDEA-1]]'s planned full-text search index** (decisions/open-questions/progress/repo docs search), or are these two different "index" concepts that happen to share a name?
