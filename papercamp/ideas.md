Paper Camp
A local-first, AI-native project companion that lives where your work lives.

Most project management tools are built around teams, dashboards, and the assumption that your work needs to be somewhere on the internet. Paper Camp rejects that. It lives in your repository, versioned alongside your code, invisible to everything except you and your AI assistant.
The core idea is simple: every project deserves a memory. Not a kanban board, not a ticket system — a structured, honest record of where you started, where you are, and where you're going. A place where ideas don't get lost in chat history or sticky notes. A place your AI can read in seconds and immediately understand the current state of your intent.

The folder is the database.
A papercamp/ directory sits at the root of your project. It contains markdown files with a defined structure — ideas, plans, progress, decisions, open questions. No external services, no sync, no accounts. Every change is a git commit. The history of your project is the history of those files.

AI as a first-class collaborator.
Paper Camp is designed around the way humans actually work with AI assistants. At the start of every session, you point your assistant to papercamp/ and it knows everything — what was built, what was decided, what's next. No re-explaining. No lost context. The structured files are not documentation written after the fact; they are the living source of truth that both you and the AI maintain together.

Planting seeds, not filling templates.
New projects don't start from static boilerplate. They start from intent. You describe what you want to build — a single high-level idea — and the system scaffolds the initial papercamp/ structure around that intent. The AI initializes the infrastructure based on your blueprint, not a generic template. Every project begins with its own logic, not someone else's defaults.

The interface is analog by choice.
When you run papercamp in your terminal, a local web interface opens — built with Paper UI, styled like a retro creative dashboard. Analog gauges display project health and momentum. Focus toggles let you isolate a single task and feed it cleanly to your AI without noise. It feels like a creative studio tool, not enterprise software.

It grows with you.
Paper Camp doesn't tell you how to manage your project. It gives you a structure minimal enough to stay out of the way and rich enough to be genuinely useful. Over time, the papercamp/ folder becomes an artifact — a honest, chronological record of how something was made, decision by decision, idea by idea.

Built for makers who work alone, think in systems, and use AI as a creative partner — not a shortcut.

---

### Project docs browser

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

### Settings page with sidebar and editable configs

Turn Settings from a single static info+icon page into a real sidebar-driven configuration workspace — but scoped honestly to what *this* repo's stack actually has, not a generic eslint/prettier list. The existing project-info card (name, version, icon — already built) becomes the sidebar's default "General" section rather than the whole page.

Feature ideas:

- **Sidebar layout** — mirror `PlansSidebar`'s structure: a left rail of sections, main area showing whichever one is selected. "General" (current project-info card) is the default landing section.
- **Auto-discovered config sections, not a hardcoded list** — a new `GET /api/configs` route that scans the repo root for config files that *actually exist* (this repo today: `biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`) and returns only those. Keeps the feature honest as the stack changes, instead of a stale list baked into the UI.
- **Editable raw contents per config** — selecting a config loads its text in an editor area (even a plain `<textarea>` to start; a lightweight syntax highlighter for JSON/TS is a nice-to-have later) with a Save button.
- **Validate before writing** — for JSON-shaped files (`biome.json`, `tsconfig.json`, `package.json`) parse and reject invalid JSON before it touches disk, surfaced as an inline `Alert`. Never let a typo corrupt a config file silently.
- **Write-path security boundary** — the save endpoint must only accept filenames from the same allowlisted scan as the read side, never an arbitrary path. This is a local-only dev tool, but a write endpoint that takes any path is still worth avoiding on principle.
- **Editable project identity** — make the existing "General" card's project name field actually editable (it's read-only today), writing back to `.paper-camp/config.json` — pairs naturally with the icon upload that's already shipped.

Why this one second: it needs a new write path (with real validation/security thought, unlike the read-only Docs idea above), so it's more work and slightly more risk — better attempted once the Docs page's read-only pattern is proven out.

---

### The Stack — right-side status & history panel

A persistent right-hand panel, present across every page (not a route — more like the `NavigationIsland`, but docked right and full-height), showing the active plan and a feed of recent project activity. Default open, toggleable closed.

**Look:** styled directly after paper-ui's showcase `DetailSidebar` (`src/showcase/components/detail-sidebar.tsx` in the `paper-ui` sibling repo) — the closest existing thing to "chalkboard style, full height" already built. Concretely: `position: fixed`, pinned `right`, `top: 0` to `bottom: 0`, slides in/out via `transform: translateX(...)` with a transition (not a width animation), dark chalkboard texture (`textures.ts`'s `chalkboard` — `#142e22` base + turbulence, paired with the desk-green gradient the showcase panel uses), a `Luminari`-font header with a close/toggle control, and `Caveat`-cursive uppercase labels for each content section. `Card`, `Stamp`, and `CodeBlock` all already support a `variant="chalkboard"` — log entries and status badges inside the panel should use those directly rather than inventing new dark-mode styling.

**Feature ideas, roughly in build order:**

- **Idle state — activity history** — when nothing's in progress, show a reverse-chronological log. The data already exists and is unused: `progress.md` + `/api/progress` (parsed, tested, zero consumers today — same gap the Docs page idea found). Could share a "progress feed" component with the Docs page's progress timeline, just rendered once in light theme (Docs) and once in chalkboard (here).
- **Active state — "what's in progress now"** — surface the currently in-progress plan, reusing the same `findFocusPlan` resolution logic Focus already has, plus its phase progress.
- **Live activity feed, sourced from file changes** — the honest signal for "what's happening" beyond static plan status is changes to the `papercamp/` files themselves. A file watcher (`fs.watch` or `chokidar`) on the dev server, diffing each file's previously-parsed entries against the newly-parsed ones, can synthesize human-readable lines ("phase 2/5 checked off in 'X'", "plan 'Y' marked done", "new open question raised") without inventing a new schema — it's narrating diffs of files that are already the source of truth.
- **Delivery mechanism** — the dev server is currently a plain `node:http` server with only request/response, no push. An SSE endpoint (`GET /api/activity/stream`, kept open, one event per detected change) is the smallest real-time addition Node's `http` module supports natively, no new dependency. Polling `/api/progress`/`/api/plans` on an interval and diffing client-side is the fallback if SSE turns out to be more plumbing than it's worth for a first version.

This whole idea is buildable from data and patterns that already exist in the codebase — no new concept of "an agent" required, just a live view of the same plan/progress state the rest of the dashboard already shows.

---

### Agent orchestration — launch, watch, and steer tasks from the dashboard

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
