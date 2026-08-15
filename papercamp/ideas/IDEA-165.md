---
id: IDEA-165
title: Stage files, write the message
type: feat
status: idea
created: 2026-08-13
updated: 2026-08-14
tags:
  - app
  - git
  - ux
subject: App UI
---

The git page commits everything, always, and gives no way to write a commit
body. `git-page.tsx` builds `commitFiles` as `files.map(e => e.path)` — every
changed file — and `DeliverCommitInputRow` renders a single title `Input`.

Evidence from this repo: commit `a65a180` is titled "Update about.md for stack
panel and activity stream changes" and contains nine files — three new ideas, a
`nextId` bump, an archive move, `run-order.md` and `activity.ts`. The message
accurately describes two of them. That is the surface working exactly as built.

**The server is already ready.** `git.ts`'s `commit(files, title, message)`
`git add`s only the paths it is given (skipping any already fully staged) and
runs `git commit -- <pathspecs>`, carrying a rename's source path along so a
staged rename doesn't leave a dangling deletion behind. Partial commits work
today; the client just never asks for one.

### Staging is real

A checkbox in the changed-files list stages and unstages for real — `git add`
and `git restore --staged` against the index — not a commit-time filter that
forgets the moment you navigate away. Two new routes, `POST /api/git/stage` and
`POST /api/git/unstage`, each taking a path. The `staged` field already on
`GitStatusEntry` and `FileDiffEntry` becomes meaningful instead of always false,
and the `staged` Stamp that both the sidebar and the diff header already render
starts appearing.

Commit then commits **the index**, not a client-side list: `commitChanges` stops
passing a file array once anything is staged, and the button reads "Commit N
staged". With nothing staged it keeps today's behaviour — commit everything —
but says so on the button rather than implying a selection that was never made.

Partial staging follows from real staging: a file with both staged and unstaged
hunks becomes representable and has to render as such. git's two-character
status code already carries it (`M ` staged, ` M` unstaged, `MM` both).
Surfacing those letters is [[IDEA-167]]'s job; this idea needs the field to
exist, and shows a partially-staged file as an indeterminate checkbox.

Hunk-level staging is out of scope. File granularity only.

### The commit body

`useDeliverCommitForm` holds `commitMessage`, passes it to `commitChanges`, and
never returns it — so no consumer *can* render it. Return it, and add a
collapsible body `Textarea` beneath the title. The wand fills both; today it
writes a body no human ever sees. `a65a180` carries a two-line body that never
appeared in a field.

### Drop the Fix button from the git page

`git-page.tsx` calls `useDeliverCommitForm(undefined, commitFiles)` — no plan.
`DeliverCommitButton` swaps Commit for Fix whenever Quality, Tests or
Consistency fails, and Fix is disabled unless `plan?.id` exists. On the git page
that condition can never be true, so a failing check replaces Commit with a
permanently disabled button carrying no tooltip and no path forward: the page
becomes uncommittable until the check is fixed from somewhere else.

Fix is plan-scoped by nature — it writes `fixes` onto a plan and launches
run-all. It has no meaning without a plan and must not render on the git page at
all. The page keeps Commit, and surfaces a failing check as a warning beside it
rather than by removing the action.

### Also

`GitActionsRow` (`git-page.tsx`) and `DeliverEmptyState`
(`deliver-controls.tsx`) are two implementations of the same Sync/Push/Pull row
that disagree — the first always shows all three, the second shows Push alone
when ahead and Sync+Pull otherwise. Extract one.

The git page's entire commit interaction lives in
`features/plans/components/deliver-controls.tsx`, a 463-line module owned by
another feature, and this idea pushes the two surfaces further apart: the git
page needs staging and a body, the idea view needs the Fix action. Split the
shared form into something both own instead of growing the conditional.

One of three slices over `features/git/`: [[IDEA-166]] → [[IDEA-167]] → **[[IDEA-165]] (this)**. Last because the indeterminate-checkbox state for a partially-staged file needs the `status` field [[IDEA-167]] adds.

### Phases
- [x] Add stage/unstage routes
      `POST /api/git/stage` and `POST /api/git/unstage`, each taking a path, running `git add` / `git restore --staged` against the index.
      run: 2m50s · 6k in · 4.5k out · sonnet-5
- [ ] Wire real staging into the changed-files checkbox
      Checkbox calls the routes; the `staged` field drives the Stamp; a partially-staged file (`MM`) renders as an indeterminate checkbox.
- [ ] Commit the index instead of a client list
      `commitChanges` stops passing a file array once anything is staged; the button reads "Commit N staged" and keeps commit-everything when nothing is staged.
- [ ] Add the collapsible commit body field
      Return `commitMessage` from `useDeliverCommitForm` and render a collapsible body `Textarea` beneath the title; the wand fills both.
- [ ] Drop Fix from the git page
      Never render the plan-scoped Fix action without a plan; surface a failing check as a warning beside Commit rather than by disabling the button.
- [ ] Extract the shared Sync/Push/Pull row and split the form
      Reconcile `GitActionsRow` and `DeliverEmptyState` into one row, and split the deliver form so the git page and idea view each own their variant.
