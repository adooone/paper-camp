## Runtime stays server-first; no desktop shell; mobile via PWA

**Date:** 2026-07-19
**Status:** decided

**Context:** Preparing for actual usage raised the runtime question: the app is
a Vite-served web app today — should it become a desktop application (Electron/
Tauri), and how should a phone control the flow? The app's essence constrains
the answer: it must own filesystem access (the corpus), a git working tree, and
long-lived agent child processes, so a local server exists in every
architecture; the only real question is what the client shell is.

**Decision:** Server-first, permanently: a packaged local server (the future
`paper-camp` command) owning files/git/agents, with the browser as the client.
No desktop shell now — a browser tab loses nothing for a monitoring-and-control
surface. Mobile is a PWA over the same responsive web app (already reachable
via Tailscale), with push notifications; a native or wrapped app only if the
PWA ceiling is genuinely hit. Revisit the desktop shell only if tray presence,
OS notifications, or autostart become real needs — and then prefer Tauri over
Electron (system webview, no bundled Chromium).

**Rationale:** One codebase serves desktop browser, remote, and phone; the
server is the product and every client is thin. Electron would add per-OS
packaging and update burden to deliver features (tray, notifications) that PWA
push and a pinned tab approximate at near-zero cost. The mobile use-case is
directing the flow — approve, promote, archive, nudge, watch the stack — not
authoring; that's exactly what a responsive control surface does well.

## Quality-status "stale" requires both lint and format stale, not either

**Date:** 2026-07-13
**Status:** decided

**Context:** IDEA-58 phase 1 extracted the duplicated `qualityStatus`/`testStatus`/
`consistencyStatus` derivation out of `status-bar.tsx` and `stack-panel.tsx` into
one shared `deriveCheckStatuses` helper. The two copies had silently diverged:
`status-bar.tsx` treated the combined "Quality" status as `stale` if *either*
lint or format was stale, while `stack-panel.tsx` only reported `stale` when
*both* were. Unifying to one helper meant picking one behavior.

**Decision:** Keep `stack-panel.tsx`'s semantics — `stale` only when both lint
and format are stale; if either has already reported pass/fail, the merged
status reflects that instead of masking it as stale. `status-bar.tsx` now
follows the same rule via `src/app/utils/check-status.ts`.

**Rationale:** Lint and format are triggered together in every call site, so the
partial-stale state is transient; treating a known pass/fail as more useful
information than a stale flag on the other check matches how the Stack panel's
more deliberate `useMemo` version already worked.

---

## Status derives from the PR (matched by id), not from local branches

**Date:** 2026-07-09
**Status:** decided

**Context:** `IDEA-56`'s first cut keyed the middle rungs off *local branch
existence* (`in-progress` = a `feat/idea-N-…` branch exists; `review` = branch +
all phases checked) and resolved `done` per-entity with `gh pr list --head
<computed-branch>`, where the branch name was recomputed from the entity's
current title. Dogfooding the merged feature exposed three failures of the branch
signal: a **rename** breaks the lookup (IDEA-56 itself — merged, but stuck at
`review` because its branch name was recomputed from the new title and no longer
matched the real PR head); a **squash-merge deletes the branch**, so the signal
vanishes after merge; and a **fresh clone** has no feature branches at all, so
everything derives to `planned`. It also cost a `spawnSync git branch` plus a
per-entity `gh` call on every read.

**Decision:** Derive status from the entity's **GitHub PR, matched by id**, not
from any local branch. One `gh pr list --state all` resolves the whole worklist,
indexed by the `**Plan:** \`IDEA-N\`` line `draft-pr.yml` stamps into every PR
body (falling back to the `feat/idea-N-` id prefix of the head branch), cached
per repo root. Ladder: idea (no phases) → planned (phases, no PR) → in-progress
(open/draft PR) → review (open/draft PR + every phase checked) → done (PR merged)
→ dropped (closed-unmerged PR, or the stored override). Offline / no-`gh` falls
back to the stored override, else a phases-only `planned`. Removed
`listBranchesByEntityId` and all local-branch reading from the derivation; the
per-branch `resolvePrMerged`/`resolvePrInfo` became `resolvePrsByEntity`.

**Rationale:** The PR is canonical where the local branch isn't — the id never
drifts on rename, the PR persists in GitHub after the branch is deleted, and it
reads the same on every clone. Matching by the `**Plan:**` id anchor is what
makes all three rename/delete/clone failures impossible. One `gh` call for the
whole worklist is also cheaper than the old per-entity `gh` + `git branch` on the
hot path. This supersedes the branch-existence signal from `IDEA-56`'s first cut;
the `done`-fallback and stored-`dropped` behaviour it settled are unchanged, only
the PR resolution moved from a computed branch name to the id.

## `archive/` stops moving on `done`; migration keeps `status:` only where it can't derive

**Date:** 2026-07-08
**Status:** decided

**Context:** `IDEA-56` phase 6 swept the ~55 existing entities' stored `status:`
now that it's a derived-first field, and had to settle whether the `archive/`
move (done on every `done`/`dropped` write, in `routes/plans.ts` and
`mcp/tools.ts`) survives. Actually clearing stored `status: done` and
re-deriving live (via `gh`, network on) surfaced two things: `readEntities`
already reads `ideas/` and its `archive/` subdirectory as one merged list, so
a file's directory never affected any read path — only the archive-on-write
commit was ever in question. And most of the ~51 archived entities predate
the per-feature-branch workflow (`FEAT-22`, 2026-06-27) or were renumbered
into `IDEA-N` by the id-unification migration (`IDEA-43`, née `FEAT-42`), so
`branchName(id, type, title)` computed from their *current* id never matches
their real historical branch/PR name — `deriveStatus` has no way to
reconstruct `done` for them and mis-fires a false-negative "confirmed not
merged" instead.

**Decision:**
- Stopped archiving on `done` in both write paths (`routes/plans.ts`,
  `mcp/tools.ts`): `done` is derived from a merged PR, so moving the file on
  every approve is a needless commit with no read-path benefit. `dropped`
  still archives — it has no live signal, so the stored override is the only
  place that fact lives, and archiving still tidies it out of the active
  worklist view. Existing files already under `archive/` were left in place;
  moving them back would just be the same needless commit in reverse.
- Fixed `resolvePrMergedForEntity` (`core/readers.ts`): when an entity has no
  currently-existing branch, `gh` finding no PR under the *computed* name is
  no longer treated as confirmed non-merge (which was silently downgrading
  every pre-`FEAT-22` and pre-unification `done` entity to `planned` on a
  live read) — it now falls back to `undefined` (unresolved), which
  `deriveStatus` already trusts the stored `done` fallback for. A real
  existing branch confirmed non-merged still corrects a stale stored `done`
  down, unchanged.
- Cleared the stored `status:` override on the entities that verifiably
  derive clean without it: `IDEA-35`/`36`/`39`/`44` (their `idea`/`planned`
  override no longer matched the phases-based derivation once phases
  existed) and `IDEA-40`/`41`/`55` (post-unification entities whose live
  branch name matches a confirmed-merged PR). Kept `status: done` on every
  other archived entity, including `IDEA-43` — its `unify-the-ideas...`
  branch existed locally with zero commits ahead of `main` and no PR of its
  own (the real merge landed under the pre-renumbering `feat-42` branch), so
  it was deleted (`git branch -d`, fully merged, no data loss) to stop it
  confirming a false non-merge for that entity now that the fix above
  distinguishes "no branch" from "a real branch, checked, not merged."

**Rationale:** The read-merge across `ideas/` and `archive/` already made the
physical split cosmetic; keeping the commit that produces that split
without a corresponding behavior difference was the exact "needless commit"
this idea's premise argues against. The `resolvePrMergedForEntity` fix was
necessary, not optional busywork: without it, simply keeping `status: done`
stored (the migration's own conclusion for ~46 entities) would not have
survived the first live `gh`-connected read, since the ladder would still
silently recompute and overwrite it to `planned`.

## Status is derived from git and PR, not stored

**Date:** 2026-07-08
**Status:** decided

**Context:** Lifecycle `status` is a stored frontmatter field, so keeping it
honest means writing files — a plan reaching review, a branch being cut, the PR
merging are each a hand edit or an agent/CI commit — and the recurring failure is
drift (the index says `in-progress`, the file says `review`, the PR is already
merged, nobody updated anything). `FEAT-35`'s plan and the first cut of `IDEA-56`
both tried to *sync* the stored field from GitHub, which still commits on every
merge — the exact churn we're trying to remove.

**Decision:** Stop storing lifecycle status and derive it from signals that
already exist, so it can't go stale because there's nothing to keep in sync:

- **idea** — no plan yet (no `### Phases`).
- **planned** — has phases, no branch.
- **in-progress** — a branch for the entity **exists** (matched by the
  `feat/idea-N-…` convention `branchEntityId` parses). Branch *existence*, not
  "is it checked out": status must read the same on every clone, so "is it the
  current branch" stays a purely-local signal that only drives the active-plan
  highlight.
- **review** — the branch exists and every phase is checked.
- **done** — the entity's PR is merged, read from a **cached live `gh`/API
  lookup** (not a persist-on-merge write, not git history — a squash-merge
  deletes the branch and drops its commits from `main`, so GitHub is the only
  reliable "was this merged" source).

A minimal stored `status:` survives only for what reality can't express —
**dropped** (abandonment leaves no branch and no merge) and closing a **planless
idea or `note`** (never gets a branch or PR) — and doubles as the **offline /
no-GitHub fallback**. So the field demotes from source-of-truth to
override-plus-fallback; it does not disappear.

**Rationale:** This removes the status-sync commits and the drift they cause —
the highest-leverage fix for the "index/status is stale" churn that keeps
generating review nits. The file stays authoritative only where reality has no
signal, which is exactly where a human call is needed anyway. It keeps the
already-decided "planless ideas close via explicit frontmatter status" escape
hatch (that *is* the stored override), revises "Status: review is the human
gate" (review now *is* all-phases-checked; done *is* merged), and moots
`FEAT-35`'s merge→`done`+archive phase. Open consequence for the planning pass:
if done is derived, moving a file to `archive/` is itself a needless commit, so
whether the `archive/` directory survives is now in question. To be implemented
via `IDEA-56`.

## The plans worklist is one filterable list — no Board/Review/Closed tabs

**Date:** 2026-07-07
**Status:** decided

**Context:** `IDEA-40` phase 4 ("Fold Review into the Plans route") added a
`List | Board | Review | Closed` `Tabs` row to the Plans page. But `IDEA-42`
had already made the worklist a single filterable list, and
`PlanFilterColumn`'s status chips already toggle `review`/`done`/`dropped`
(alongside Backlog/planned/in-progress). So Review and Closed were a second,
coarser filtering mechanism over the same data, and Board a third parallel
view — three ways to slice one list.

**Decision:** The Plans page renders exactly one view: the filterable worklist
(`ListView`). Removed the `Tabs` row and the Board/Review/Closed views, their
`view`/`setView` store state, and the components they alone used
(`BoardView`, `KanbanCard`, `KANBAN_COLUMNS`, `StatusPlanList`, `PlanCard`, the
`.board-view-table` CSS). Status-scoped browsing lives entirely in
`PlanFilterColumn`'s chips. This supersedes `IDEA-40` phase 4's Tabs approach;
the rest of `IDEA-40` (param routes, `Breadcrumb`, docs-on-README) stands.

**Rationale:** One list with one filter mechanism is the shape `IDEA-42`
committed to; the tabs reintroduced the split it removed. The chips express
review/closed and more granularly than fixed tabs (multi-select, live counts),
and dropping Board deletes a whole parallel rendering path with its own
responsive CSS to maintain. The single list is the surface worth investing in.

## Branch management is manual

**Date:** 2026-07-05
**Status:** decided

**Context:** Launching an agent task (single phase or run-all) auto-ran
`ensureBranch`, which creates the plan's branch *from main* and checks it out.
Mid-plan that silently yanks the user off their real working branch — surfaced
when starting `FEAT-42`'s last phase from the UI created a stray
`feat/idea-43-…` branch off main while the actual work lived on
`feat/feat-42-…`. The `done`/`dropped` archive path had the same auto-call.

**Decision:** Nothing in the app switches git branches on its own. Agent
launches and status changes run on whatever branch is checked out. Instead,
the entity detail surfaces branch state: an amber working-branch alert when a
`planned`/`in-progress`/`review` entity is open on a branch that isn't its own
(matched by the entity id the branch name encodes), with a manual
"Create branch" button — `POST /api/git/branch`, calling the same
`ensureBranch` helper, now user-initiated — plus a muted confirmation line
when the branch already matches.

**Rationale:** A branch switch changes workspace state the user is standing
in; doing it as a side effect of "run this phase" is exactly the kind of
surprise the alert can prevent without the automation. The helper and its
branch-naming convention survive unchanged — only who pulls the trigger moved.

## Entity ids are lifetime IDEA-N

**Date:** 2026-07-05
**Status:** decided

**Context:** `IDEA-43`'s single-file evolution merges ideas and plans into one entity
("idea" for life, plan as a section), which forces the id question: today ideas are
`IDEA-N` and plans are `<KIND>-<N>` (`FEAT-42`, `FIX-2`, …), and the git/GitHub surface
— branch names, commit `Refs:` footers, the draft-PR "Plan:" line, `FEAT-36`'s planned
PR mirror — keys off the plan form. Keeping both would mean an entity changes identity
mid-life (or carries two ids), reintroducing exactly the split the merge kills.

**Decision:** One id space, one lifetime id: every entity is `IDEA-N` from capture to
done, unchanged when its plan section lands. `type` (feat/fix/…) carries the
Conventional-Commits meaning ids used to encode — commit types and branch prefixes
come from it (`feat/idea-99-…`), and `Refs:` footers carry the `IDEA-N`. The per-kind
`nextId` counters in `config.json` collapse into a single idea counter. How migrated
legacy entities map onto this space (pairs keeping the idea's id, orphan plans getting
minted ids, multi-plan splits) is specified in the migration plan, not here.

**Rationale:** The id's job is stable reference, not classification — kind/type is
frontmatter and can change (a "feat" that turns out to be a "fix") without breaking
every reference to the entity. A single lifetime id is also what makes "the idea *is*
the plan file" honest: nothing about the entity's identity changes when it matures.

## Ideas and plans merge into one worklist; ideas carry no tracked status

**Date:** 2026-07-05
**Status:** decided

**Context:** `FEAT-42` unifies the `/` plans list and the standalone `/ideas` list
into one worklist: idea rows render as group parents (lightbulb icon, title,
Extend/Draft-plan actions, a derived "2/3 plans done" children summary) with
their linked plans nested beneath via the existing `idea:` backlink, and plans
without an idea stay top-level. This directly supersedes the 2026-06-19 decision
to split the sidebar into separate "Ideas" and "Backlog" sections, and
generalizes the 2026-07-03 "Planless ideas close via explicit frontmatter
status" decision from a single escape hatch (`status: done`) into a proper
`kind: note` asymmetry (`open → done/dropped`, enforced by
`ideaFrontmatterSchema`) for ideas that never need a plan.

**Decision:** The `/ideas` list route and its header nav item are removed;
`ideas-page.tsx` and `ideas-board.tsx` are deleted since the unified `/` list
(via `plans-page.tsx`'s `activeIdeaTitle`/`IdeaDetail` branch, landed in phase 4)
already renders both the worklist and idea detail. `NewIdeaButton` (title
"New idea", refine-first — its modal now has a note toggle setting
`kind: 'note'`) and `AddToBacklogButton` (relabeled "Quick plan" — today's
plan-first creation, unchanged behavior) both move into `plans-header.tsx`'s
toolbar. `FEAT-40`'s per-item idea-detail address is unaffected by this
removal — that plan hadn't landed a `/ideas/$id` param route yet at the time
of this change (idea detail was always store-state driven, not a URL route),
so there was no separate detail route to preserve; when FEAT-40 adds param
routes later, `/ideas/$ideaId` can point at the same unified page.

**Rationale:** Two lists implied two workflows, but ideas were always meant to
funnel into plans — keeping them as a separate top-level list understated that
relationship and duplicated list chrome (header, filters, row language) for no
benefit once the group-aware tree selector (phase 3) and renderer (phase 4)
existed to show both in one place. Superseding the Ideas/Backlog sidebar split
outright (rather than leaving it stale) keeps `decisions.md` from contradicting
the shipped UI.

## Dense lists are row cards, not paper-ui Table

**Date:** 2026-07-04
**Status:** decided

**Context:** `FEAT-37`'s first phase originally specified paper-ui `Table` with
`TableCellDropdown` for the dense plans list. The phase-1 agent run surfaced that
`TableCellDropdown` was never exported from paper-ui's public API (it exists in the
source and in stray per-module `.d.ts` files, but neither `dist/index.js` nor
`dist/index.d.ts` carry it), and on review the Table look was rejected anyway.

**Decision:** The dense lists are hand-composed rows that look like a table: each row
a one-line paper-ui `Card` with compact padding and small gaps, under a header `Card`
in a contrasting texture (kraft over paper), all sharing one grid column template
(`.plan-rows-grid`). Rows are read-only — the title owns all flexible width, status
renders as a `Stamp`, and edits (including status) happen inside the plan detail;
inline editing via a row-level `Select` was built first and dropped on review, since
the control cost row height and title space without earning them. Plans and ideas
additionally split onto separate routes rather than sharing one page.

**Rationale:** Rows-as-cards keep the app's warm card language while hitting the same
density target, and they remove the dependency on an unexported component. The
paper-ui export omission is still worth fixing upstream, but no paper-camp feature
should be blocked on a cross-repo release.

## Planless ideas close via explicit frontmatter status

**Date:** 2026-07-03
**Status:** decided

**Context:** An idea's planned/done status is derived: done only once every plan whose
`idea:` field references it is done/dropped. `IDEA-37` (Fable capability-window tasks)
is a usage pattern with nothing to build — it will never have a linked plan, so under
pure derivation it would sit in the backlog as `planned` forever.

**Decision:** Idea frontmatter accepts an optional `status: done` that
`deriveIdeaStatuses` honors ahead of the linked-plan derivation
(`ideaFrontmatterSchema`, `parseIdeaFile`, and `formatIdeaFile` carry the field).
Derivation stays the default for every idea that omits it; explicit `planned` is
ignored in favor of derivation. Derived statuses are never written back into files —
the field only enters a file by hand or by a caller that passes it deliberately.

**Rationale:** The alternative closes were dishonest or destructive: linking the idea
to an unrelated done plan fakes provenance, and deleting the file loses the reusable
prompt templates it carries. An explicit close keeps the record, keeps derivation the
single mechanism everywhere else, and adds one optional field rather than a parallel
status system.

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
