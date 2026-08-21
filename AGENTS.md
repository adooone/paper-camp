# Agent instructions for paper-camp

This file is the source of truth for how AI assistants should work in this repository.

## Codebase map

Use this instead of exploring from scratch — it is kept current like the code.

- `src/core/` — the corpus engine, no UI or server deps: `parse/` (markdown entity grammar), `serialize/` (writing entities back, content hashes), `readers.ts` (entities → plans/ideas), `status/` (derived status), `thread.ts` (thread/log messages), `run-order.ts` + `run-order-file.ts` (queue order), `roadmap.ts`, `trail.ts` (idea→release trace), `git-pr/` (PR state), `scaffold/` (first-run templates), `stats.ts`.
- `src/app/server/` — the dev-server API (loaded via `ssrLoadModule`, so `@/` imports work): `routes/` (HTTP endpoints; `routes/agent.ts` is the agent-facing surface), `agent.ts` (orchestration: phase runs, the run-all queue, fix passes, read-only prompts), `agents/` (CLI adapters for claude-code and opencode), `status.ts` (the lint/format/test/consistency checks and the run-all verify gate), `git.ts` (branch/commit manager), `services.ts` + `capabilities.ts` (connection probes), `feedback-reply.ts` (Scout chat edit application), `run.ts` (subprocess helper).
- `src/app/features/` — UI by domain: `plans/` is the heart (`views/entity-detail.tsx` is the idea/plan page, `prompts/prompts.ts` holds every agent prompt), plus `roadmap/`, `settings/`, `stats/`, `tasks/`, `docs/`, `diff/`.
- `src/app/components/` — shared UI: `stack-panel/` (the control surface — all actions live here), `shell/` (StatusBar, layout), `idea/`.
- `src/app/stores/` — zustand `app-store.ts` composed from `slices/`.
- `src/cli/` — the `paper-camp` bin; `dev-server.ts` boots Vite + the API.
- `src/mcp/` — the MCP server exposing the corpus.
- `src/toolbar/` — the in-app dev toolbar web component, mounted inside the target application.
- `src/types/index.ts` — every shared type.
- `papercamp/` — the corpus itself: `ideas/<ID>.md` (one file per idea, plan included), `config.json` (id counters, default agents, subjects), `run-order.md`, `suggestions.md`.

Verify with: `pnpm run check-types`, `npx biome check . --write`, and `npx vitest run` (plain — `pnpm test` adds coverage and is much slower).

## Do one phase at a time

When a user asks you to work on a plan (each entity — an *idea* with its plan as a `### Phases` section — is its own file at `papercamp/ideas/<ID>.md`), complete **only the phase they explicitly asked for** unless they tell you otherwise. Do not automatically continue into later phases.

If the boundary between phases is unclear, or if you are unsure whether the user wants the next phase done, ask before continuing.

## Update the plan as you go

Mark the completed phase `[x]` in the entity's file (`papercamp/ideas/<ID>.md`) and keep its `status:` frontmatter field honest (`in-progress` / `review` / `done`).

When all phases of a plan are complete, set its `Status` to `review` — not `done`. The `review` status means a human (or a later agent) needs to approve the work before it's closed. Plans that reach `done` should only get there via an explicit "Approve & close" action, never because the last phase was checked off automatically.

## UI code style and UX principles

For `src/app` code, also follow `docs/CODE_STYLE.md` (how the code is written) and
`docs/UX_PRINCIPLES.md` (how the UI should feel to use — layout stability, visual
hierarchy, motion). Read both before making UI changes.

## Working with the paper-ui sibling repo

The dashboard is built on `@dendelion/paper-ui`, which lives in a sibling repo at
`~/dev/paper-ui` and is published to npm. `package.json` declares it as a
normal registry range (`"@dendelion/paper-ui": "^0.17.0"`) — this is required
for CI and for anyone installing `paper-camp` for real; a `link:../paper-ui`
relative path only resolves on this dev machine and breaks everywhere else
(this is exactly the bug that broke the CI quality check and would have
broken `npm publish` too).

- **For active co-development with paper-ui**, override the registry
  resolution locally without touching `package.json`: run
  `pnpm link ../paper-ui` from `paper-camp`'s root once. This symlinks
  `node_modules/@dendelion/paper-ui` to the sibling repo for your local
  checkout only — it's invisible to git, CI, and anyone else's install. Run
  `pnpm install` (no args) to go back to the registry-resolved version.
- **paper-camp imports from `dist/`, not `src/`** either way. paper-ui's
  `package.json` points `main`/`module`/`types` at `dist/index.{js,mjs,d.ts}`.
  If you edit anything under `~/dev/paper-ui/src` while linked, it has **no
  effect** in paper-camp until you run `pnpm run build` inside `~/dev/paper-ui`.
- **Publishing a new paper-ui version:** in `~/dev/paper-ui`, write a
  changeset (`.changeset/*.md`, sized correctly — new components/exports are
  `minor`, behavior-preserving fixes are `patch`), run `pnpm run version`
  (needs a `GITHUB_TOKEN` env var for the changelog generator — `gh auth
  token` works), verify with `pnpm run check-types && pnpm run build`, commit,
  then `pnpm publish --access public`. Bump paper-camp's `package.json` range
  afterward and `pnpm install`.
- **Check the real source, not just the `.d.ts`.** Before assuming what a
  paper-ui prop does, read the component under `~/dev/paper-ui/src/components/`
  (and its showcase entry under `~/dev/paper-ui/src/showcase/`) rather than
  guessing from the type signature alone.
- **When changing paper-ui itself,** follow `~/dev/paper-ui/AGENTS.md`/
  `CODE_STYLE.md` (one component per file, `cn()` for classNames, SCSS modules
  for styles — no hardcoded hex in `.tsx`), then run `pnpm run check-types` and
  `pnpm run build` there before switching back to paper-camp.
- **Adding to paper-ui's public API** (new component, new exported prop) means
  updating both `src/components/<name>/index.ts` *and* the top-level
  `src/index.ts` barrel — both re-export the public types, and it's easy to
  update one and forget the other.

## Verifying UI changes visually

Use the Claude in Chrome MCP tools (`mcp__Claude_in_Chrome__*`) to actually look
at a UI change before reporting it done, not just `tsc`/lint.

- **Check for an already-running dev server first** — `lsof -i :3333` (or
  `pgrep -af vite.app.config`). This repo is usually already running under
  `pnpm dev` in another session. Don't start a second instance; if port 3333 is
  taken, your new one will silently bind 3334 and nothing will be reachable
  through it.
- **`localhost`/`127.0.0.1` will not load in the browser the MCP tools drive** —
  that browser runs on the user's machine, not in this sandbox, so loopback
  addresses point nowhere useful. Use the box's Tailscale hostname instead:
  `http://deimos:3333/` (check `pnpm dev`'s own "Network:" log lines if the
  hostname ever changes). A direct `navigate` to a sub-route (e.g. `/plans`)
  can hit a SPA-routing error page on first load — navigate to `/` first, then
  click through the app's own nav.
- After navigating, `browser_batch` a `screenshot` and actually look at it; check
  `read_console_messages` for thrown errors before calling a change verified.

## Title style

An entity title is a noun/verb phrase, at most 40 characters, roughly 3–6
words. No em-dash subtitles, no trailing clause — the symptom, mechanism, and
detail belong in the body's first paragraph, not the title. One style for every
type; a fix is not licensed to be a sentence. This holds for every author —
human, desk capture, suggest-ideas, conversation captures — and the branch
scheme below depends on it (the kebab title is the branch slug).

- Example: "Desk is broken under the mount — router basepath, API base, and a
  friendlier route" → "Desk breaks under the mount", with the rest of the
  sentence moved into the body.

## Branch workflow

Work on a plan (feature, fix, refactor, etc.) happens on a feature branch, not
directly on `main`. A draft PR is auto-created on first push.

- **Branch naming:** `<type>/<lowercase-id>-<kebab-title>`
  - `type` is one of: `feat`, `fix`, `refactor`, `chore`, `docs` (the entity's
    `type` frontmatter field, matching commitlint's `type-enum`; entities
    without a type yet default to `feat`)
  - `id` is the lowercase lifetime entity id (e.g., `idea-43`) — it never
    changes, even when the entity's type does
  - Title is the entity's short title in kebab-case
  - Example: `feat/idea-43-unify-the-ideas-and-plans-worklist`
  - Pre-migration branches keep their legacy `feat/feat-22-…` names; only new
    branches use entity ids

- **When to create a branch:** Before starting any plan's first phase. The
  branch lives for the plan's entire lifecycle — from `in-progress` through
  `review`.

- **PRs:** A `.github/workflows/draft-pr.yml` workflow auto-creates a **draft**
  PR on the first push to any feature branch. The PR stays draft until human
  review is ready. CI runs on the PR via the existing `ci.yml`. The PR is
  authored by the **Scout** GitHub App (`scout[bot]`), not
  `github-actions[bot]` — `draft-pr.yml` mints a short-lived installation
  token via `actions/create-github-app-token`, using the `SCOUT_APP_ID`/
  `SCOUT_PRIVATE_KEY` repo secrets.

- **Merging: squash, always.** The repo is configured to squash-merge (no
  merge commits), default message "pull request title and description" —
  GitHub uses the PR title as the squash commit's **subject** and the PR
  description as its **body**. One commit per idea lands on `main`; the
  per-phase commit history stays on the PR (and, more durably, in the idea's
  own `### Thread` narrative) instead of duplicating it badly in
  `git log`. `sync-pr-metadata.yml` keeps the PR title in conventional-commit
  form (`<type>(<scope>): <Idea title> (IDEA-N)`) precisely so the inherited
  squash commit subject is release-please-visible — see "Commit messages"
  below.

- **`main` stays pushable.** Direct pushes to `main` are allowed but
  *conventionally* reserved for:
  - Agent writes to `papercamp/ideas/` during phase execution
    (these are the only agent writes that land directly on `main`)
  - Tiny fixes and config changes
  - Merging feature branch PRs

  All substantive plan work should use a branch and merge via PR.

- **Agents and branches:** When an agent executes a plan phase, it works on
  whatever branch is currently checked out. If the agent was started from a
  branch (e.g. via the Stack panel while that branch is active), its writes to
  the entity's file under `papercamp/ideas/` land on that branch. When the PR
  merges, those changes come along with the rest of the branch. Per-file entity
  storage means two branches working different plans touch different files and no
  longer conflict on merge.

- **Naming enforcement:** The branch naming convention is not enforced by CI
  (no branch-name lint). It is a convention agents are expected to follow,
  enforced by code review.

## Multiple worktrees / parallel checkouts

`nextId.idea` in `papercamp/config.json` is **local to whatever checkout you
allocate from** — it does not coordinate across `git worktree`s or across
someone else's checkout of this repo. Two checkouts that both branched from
the same base commit will independently hand out the *same* next id to
*different* ideas; nothing detects this until the branches are compared, and
by then both sides may already have committed work under the colliding id.
This happened for real: an agent created a worktree off the owner's active
branch to work IDEA-152/153, while the owner was independently running their
own session on the original checkout that *also* filed IDEA-152 through
IDEA-156 — on entirely different topics. Caught only because nothing had been
committed yet; fixed by renumbering the worktree's ideas to 157/158, past the
other side's allocation.

- **Before creating a new worktree or branch in this repo, ask the owner
  first** — check whether they're already working here (`git worktree list`,
  and ask directly; don't assume a single checkout is the only active one).
  This applies even when the new work looks unrelated to what they're doing.
- **Before allocating a new idea id, check `nextId.idea` in every checkout
  you know about**, not just your own — if you can't enumerate them all
  (e.g. the owner's own session, invisible to you), ask rather than assume
  your local counter is authoritative.
- If a collision is later discovered (matching `IDEA-N` with different
  content across checkouts), the fix is to renumber the *less-advanced* side
  (fewer commits, more recently created) forward past the other's current
  `nextId.idea` — rename the file, update its own `id:` frontmatter and
  every `[[IDEA-N]]`/bare `IDEA-N` cross-reference in
  both directions (the renumbered idea's own body may reference the *other*
  colliding idea's old number too — grep for both old numbers after the
  rename, not just one).

## Commit messages

Format: `<type>(<scope>): <description>`. This governs every commit an agent
writes directly (phase commits on a feature branch, direct-to-`main` commits).
The one exception is the commit `main` actually receives for a merged idea:
that's the squash-merge commit, whose **subject** is the validated PR title
(computed by `sync-pr-metadata.yml`, not hand-written to this format) and
whose **body** is the PR description — see "Merging: squash, always." above.

- `type` is one of `feat`, `fix`, `chore`, `docs`, `refactor` (commitlint's
  `type-enum`, matches plan `Kind`).
- `scope` is a **subsystem area**, not the plan number — chosen from the fixed
  list in `.commitlintrc.json`'s `scope-enum`: `core`, `cli`, `app`, `server`,
  `agent`, `plans`, `ideas`, `docs`, `settings`, `stack`, `ui`, `ci`, `config`,
  `deps`, `repo` (plus `release`/`main` for the release bot). Pick the area the
  change most affects — usually the plan's primary tag. This keeps the release
  changelog readable (`* **ci:** Add CI workflow`) instead of a context-free
  list of numbers. Adding a new area means editing the `scope-enum`.
- **Plan traceability lives in a footer, not the scope.** Add a `Refs:` trailer
  with the entity ID for any commit tied to a plan (the branch name already
  encodes it too):

  ```
  feat(ci): Add CI workflow for tests and lint

  Refs: IDEA-43
  ```

- `description` follows this repo's existing style: capitalized, like a
  changelog entry (e.g. `feat(ci): Add CI workflow for tests and lint`), not
  the lowercase imperative style some Conventional Commits guides use.
- Enforced by `.commitlintrc.json` + the `consistency` CI check: scope is
  required (`scope-empty`) and must be a known area (`scope-enum`), and
  `subject-case` is disabled so the capitalized style stays valid.
