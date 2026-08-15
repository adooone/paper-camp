---
id: IDEA-172
title: Persist drafts and UI choices
type: fix
status: done
created: 2026-08-14
updated: 2026-08-15
tags:
  - app
  - ui
  - ux
subject: App UI
---

Typed and agent-suggested commit text is lost the moment you navigate away from
the view holding it. `commitTitle`/`commitMessage` are plain `useState` in
`useDeliverCommitForm` — unmount discards them.

**A recovery path exists and navigation defeats it.** A `commit-suggest` task's
result lands on `agentStatus` as `task.suggestedCommit`, and the form has an
effect that applies it. But that effect first snapshots every
suggestion-bearing task present *at mount* into `staleSuggestionIds`, so it
won't re-apply an old one. Launch a suggestion, navigate away, let it finish,
come back: the completed suggestion is now present at mount, is marked stale,
and is deliberately ignored. The answer is sitting in the store and the form
refuses it.

On `/git` it is worse — the effect early-returns on `!plan`, and that page
always passes `undefined`, so there is no recovery at all.

Discriminate on whether the suggestion is newer than the form's last clear,
not on what happened to be present at mount.

### Persistence today

One key: `stack-open`, written by `router.tsx`. No zustand `persist`
middleware, no `sessionStorage`, no cookies.

Cookies stay unused. This is a localhost dev tool; cookies ride on every
request, cap at ~4KB, and no server code wants them. `localStorage` for
everything client-side.

Two stores already exist and each item goes to the right one:

- `papercamp/config.json` — project settings that belong in git and are shared
  with anyone who clones (agent defaults, desk, port, project name). Unchanged.
- `localStorage` — per-browser UI preference and unsent drafts. Never shared,
  never in git.

### Drafts to persist

Losing these loses typed work:

- commit title and message (`deliver-controls.tsx`) — the reported case
- the feedback chat input (`entity-detail.tsx`)
- the add-review-phases input (`add-review-phases-button.tsx`)
- the inbox question reply (`question-row.tsx`)

Modal drafts (`create-idea-modal`, `add-roadmap-item-modal`) are **not**
persisted: a draft dying with the modal matches expectation, and restoring it
would mean a stale prefill the next time the modal opens. Settings inputs
(`portInput`, `nameInput`) are not persisted either — they mirror server state
and a stored copy would fight it.

### UI choices to persist

Resetting these on every reload is friction, not data loss:

- the Plans `view` toggle (list/board)
- `planFilters` — status chips and the note filter
- `detailView`
- the Stack panel's open state (already done — the existing precedent)

### Never persist

`docSearchQuery`, where a stale query on reload hides the page behind results
nobody asked for. And anything server-derived — `plans`, `status`, `gitStatus`,
`diffFiles` — which goes stale and buys the "shows old data, then flickers"
bug class for nothing.

### Keying and cleanup

The commit draft is keyed **per entity** (`commit-draft:<ID>`), with one extra
key for the plan-less `/git` surface. A single global key would show one idea's
commit message while a different idea is open.

The draft is cleared on a successful commit — the form already resets its state
there, and the stored copy must be dropped in the same place.

Per-entity keys accrete one entry per idea forever. Each stored draft carries a
timestamp, and entries past a staleness cap are dropped on read, so a corpus
with hundreds of ideas doesn't leave hundreds of dead keys behind.

Every write goes through one small helper with the `try`/`catch` the existing
`stack-open` code already models — `localStorage` throws in private browsing,
and a failed persist must degrade to in-memory rather than break the form.

### Phases
- [x] Build the localStorage persistence helper
      One module wrapping read/write/remove in the `stack-open` try/catch, stamping each draft with a timestamp and dropping entries past the staleness cap on read.
      run: 1m48s · 6k in · 6.7k out · sonnet-5
- [x] Fix the commit-suggestion recovery
      Discriminate on whether the suggestion is newer than the form's last clear instead of snapshotting stale IDs at mount, and drop the `!plan` early return so `/git` recovers too.
      run: 4m4s · 656 in · 11.3k out · sonnet-5
- [x] Persist the commit draft per entity
      Key on `commit-draft:<ID>` plus the plan-less `/git` key, restore on mount, and clear the stored copy where the form already resets on a successful commit.
      run: 4m3s · 375 in · 12.3k out · sonnet-5
- [x] Persist the remaining draft inputs
      Feedback chat, add-review-phases, and inbox question reply, each through the helper.
      run: 4m9s · 1.1k in · 11.6k out · sonnet-5
- [x] Persist the UI-choice toggles
      Persist `planFilters` and `detailView` to localStorage. The Plans list/board `view` toggle no longer exists (removed in IDEA-136, commit 89ca57f) — dropped from scope.
      run: 1m53s · 6.9k in · 7.1k out · sonnet-5
- [x] [manual] Fix draft reset and detailView persistence bugs

### Fixes
- [x] Fix the failing "Quality" check
      Fix the failing "Quality" check in this repo.

### Thread
- [ ] 2026-08-14 [question] [agent] Run-all parked on phase 5 ("Persist the UI-choice toggles") — the agent needs a decision: Phase 5 says to persist "the Plans `view` toggle (list/board)," but no such toggle exists anywhere in the current codebase — the only list/board view-mode state was on the *Roadmap* page, and it was deliberately deleted in commit `89ca57f` ("Delete Board and Timeline views and the view-mode state", IDEA-136, 2026-08-08) in favor of full-width rows only, six days before this plan was written. Should I skip persisting a `view` toggle entirely (since it no longer exists) and persist only `planFilters` + `detailView`, or does "Plans `view`" refer to something else you have in mind that I'm not finding?
- [x] 2026-08-14 [log] [agent] Phase 1 is already built: `src/app/utils/local-draft-store.ts` exists with the `StoredEntry` timestamp and the 14-day `STALENESS_CAP_MS` this idea specifies, and drops an entry past the cap on read. It has zero consumers, so knip will report it as dead code until the wiring phases run — start from phase 2, do not rebuild the helper.
- [ ] 2026-08-14 [question] [agent] Run-all parked on phase 5 ("Persist the UI-choice toggles") — the agent needs a decision: Phase 5 says to persist "the Plans `view` toggle (list/board)," but no such state exists anywhere in the current codebase — the only list/board view-mode state was on the Roadmap page and was deliberately deleted in commit 89ca57f (IDEA-136) six days before this plan was written. Should I persist only `planFilters` + `detailView` and drop the `view` toggle from this phase's scope, or did you mean something else by "Plans `view`"?
- [ ] 2026-08-14 [question] [agent] Run-all parked on phase 5 ("Persist the UI-choice toggles") — the agent needs a decision: Phase 5 says to persist "the Plans `view` toggle (list/board)," but no such state exists in the codebase — it was deliberately deleted in commit 89ca57f (IDEA-136, 2026-08-08). Only `planFilters` and `detailView` currently exist. Should I persist just those two and drop the `view` toggle from scope, or did you mean something else by "Plans `view`"?
- [ ] 2026-08-14 [question] [agent] Run-all parked on phase 5 ("Persist the UI-choice toggles") — the agent needs a decision: Phase 5 says to persist "the Plans `view` toggle (list/board)," but no such state exists in the codebase — it was deliberately deleted in commit 89ca57f (IDEA-136, 2026-08-08). Only `planFilters` and `detailView` currently exist. Should I persist just those two and drop the `view` toggle from scope, or did you mean something else by "Plans `view`"?
- [ ] 2026-08-14 [question] [agent] Run-all parked on phase 5 ("Persist the UI-choice toggles") — the agent needs a decision: Phase 5 says to persist "the Plans `view` toggle (list/board)," but no such state exists in the codebase — it was deliberately deleted in commit 89ca57f (IDEA-136, 2026-08-08). Only `planFilters` and `detailView` currently exist. Should I persist just those two and drop the `view` toggle from scope, or did you mean something else by "Plans `view`"?
- [x] 2026-08-14 [chat] drop it from scope
- [x] 2026-08-14 [chat] [agent] Fair enough — I'll drop the `view` toggle from scope and just persist `planFilters` and `detailView`.
- [x] 2026-08-15 [review] [agent] Requests changes · 2 findings — The persistence helper and the commit-suggestion recovery rewrite are well-built and match the spec, with a good test for the helper. However two problems undercut the claimed-complete phases: the draft-restore effects don't reset their field when navigating to an entity that has no stored draft, so within a session the previous entity's in-memory draft leaks into the next entity's form and gets re-persisted under the wrong key; and the detailView persistence is silently overridden on load by the existing 'always land on Details' reset in plans-page.tsx, so phase 5's detailView persistence effectively does nothing.
