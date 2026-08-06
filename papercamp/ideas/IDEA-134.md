---
id: IDEA-134
title: Plans page decluttering
type: fix
status: review
created: 2026-08-06
updated: 2026-08-06
tags:
  - app
  - ui
  - plans
  - stack
subject: Planning surface
---

Visual review of the Plans page (2026-08-06) found the information design
sound but the chrome too heavy: nested outlined surfaces, two oversized
blocks, and duplicated git identity. Six settled changes:

1. **Open questions leaves the Plans page.** Today each question renders a
   full kraft Card with a chat bubble and an always-visible two-row
   composer — four open questions cost roughly a full viewport before the
   worklist starts. The block is removed outright: the parked-questions
   surface is [[IDEA-118]]'s dedicated inbox route with its unresolved-count
   nav badge, and the row rendering settled here becomes that view's
   design — one row per question (idea ID stamp + question text on one
   line + age, thin separators, no cards, no bubbles, no idle composers),
   a row expanding in place with its context messages and composer, one at
   a time. Reply mechanics unchanged — [[IDEA-96]]'s resolve-and-resume
   through the idea's single thread ([[IDEA-113]]). Depends on [[IDEA-118]]
   landing first so parked questions never go dark in between.

2. **Filter column loses its Card.** Search, status, and tags render
   directly on the desk background — no outlined box competing with the
   worklist card. The "Filters" heading goes too (the controls are
   self-describing), along with the `-mt-5` alignment hack the Card
   needed. Status rows with a zero count are hidden unless that status is
   active in the filter. The "Backlog" label override is dropped — the
   status reads "Idea" everywhere, matching the row stamps.

3. **Deliver drops the branch stamp.** The stamp next to "Deliver" duplicates
   the toolbar branch identity and overflows the panel edge on long
   generated branch names because the text is not ellipsized. Branch text
   remains only in state copy that needs it (the diverged message).

4. **Deterministic worklist group order.** Subject groups order by the
   best run-order rank among their plans, following the active sort
   direction; groups with no ranked plan come after, newest-updated first.
   The order derives from plans data alone, so it never re-sorts after
   first paint when late-arriving vocabulary loads.

5. **Agent stack reserves less.** The task stack holds eight cards of
   height open even when idle — the empty chalkboard stretch between Agent
   and Deliver. Reserve three; the section grows naturally while agents
   run, and Deliver sits higher the rest of the time.

6. **Header actions.** "New idea" — the product's primary entry point —
   becomes a labeled small button instead of a bare lightbulb icon. The
   Refresh button goes away (the activity stream already reloads
   everything on change). "Actualise all" renames to "Reconcile all" — it
   launches the batch reconcile and the menu should say so.

7. **The filter column sits on the desk grid.** The desk background is a
   32px graph grid, and the unwrapped column currently floats off it.
   Snap the rhythm to the grid module: left edge and top on grid lines,
   32px-tall status rows, section gaps in 32px multiples — the same trick
   the layout header already uses (64px = two cells). Aligned reads as
   intentional; off-grid reads as floating.

8. **Filter controls are paper-ui components, not custom chrome.** The
   raw `<button>`s go: status rows become `ListItem` (`active` for an
   enabled filter, status dot leading, count trailing); tag chips become
   small ghost `Button`s with `isActive` — the toggle idiom the app
   already uses for view switches. If ListItem's chrome fights the grid
   rhythm, the component gains the needed variant in paper-ui first
   rather than reverting to raw buttons here.

9. **The plan detail sidebar matches.** The entity-detail field column
   (Show / Status / Subject / Order / Agent / Tags / Actions) still wraps
   in the same speckle Card the filter column shed. Unwrap it identically:
   fields directly on the desk background, same 32px grid rhythm, same
   paper-ui controls — the two sidebars read as one system.

Out of scope: the toolbar/Stack duplication of git *actions*
(Sync/Push/Pull/Commit appearing in both) is [[IDEA-133]]'s call as the
toolbar becomes the extended StatusBar; the unnamed-buttons accessibility
sweep is its own future pass.

### Phases
- [x] Remove the Open questions block from the Plans page
      Gated on [[IDEA-118]]'s inbox route existing so parked questions never go dark.
- [x] Unwrap the filter column onto the desk background
      Drop the Card, "Filters" heading, and `-mt-5` hack; hide zero-count statuses unless active; drop the "Backlog" label override.
- [x] Drop the branch stamp next to Deliver, keeping branch text only in the diverged-state copy
- [x] Order worklist subject groups deterministically from plans data
      Rank by best run-order rank per active sort direction; unranked groups follow, newest-updated first — no re-sort on late vocabulary.
- [x] Reserve three agent cards of stack height instead of eight
- [x] Rework header actions
      Labeled "New idea" button, remove Refresh, rename "Actualise all" to "Reconcile all".
- [x] Align the filter column to the 32px desk grid
      Left edge and top on grid lines, 32px status rows, section gaps in 32px multiples.
- [ ] Replace filter-column raw buttons with paper-ui components
      Status rows → `ListItem` (active, dot leading, count trailing); tag chips → small ghost `Button` with `isActive`.
- [ ] Unwrap the plan detail sidebar onto the desk background
      Drop the speckle Card around the field column (Show/Status/Subject/Order/Agent/Tags/Actions); same 32px grid rhythm as the filter column.

### Thread
- [x] 2026-08-06 [decision] Open questions moves off the Plans page entirely — no accordion, no tabs. Its destination is [[IDEA-118]]'s inbox route (nav entry + count badge); the row-inbox rendering is logged there as that view's design. This idea only removes the block.
- [x] 2026-08-06 [decision] Review of the unwrapped column added two fixes: sidebar rhythm snaps to the 32px desk grid, and the filter controls drop raw-button chrome for paper-ui — ListItem for status rows, small ghost Button for tag chips.
- [x] 2026-08-06 [decision] The plan detail field sidebar unwraps too — both sidebars share the frameless desk-background treatment and grid rhythm.
