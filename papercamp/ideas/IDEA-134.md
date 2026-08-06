---
id: IDEA-134
title: Plans page decluttering
type: fix
status: idea
created: 2026-08-06
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

Out of scope: the toolbar/Stack duplication of git *actions*
(Sync/Push/Pull/Commit appearing in both) is [[IDEA-133]]'s call as the
toolbar becomes the extended StatusBar; the unnamed-buttons accessibility
sweep is its own future pass.

### Thread
- [x] 2026-08-06 [decision] Open questions moves off the Plans page entirely — no accordion, no tabs. Its destination is [[IDEA-118]]'s inbox route (nav entry + count badge); the row-inbox rendering is logged there as that view's design. This idea only removes the block.
