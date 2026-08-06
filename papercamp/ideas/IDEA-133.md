---
id: IDEA-133
title: Toolbar is an extended StatusBar — top, full-width, always visible, in layout
type: feat
status: review
created: 2026-08-05
tags:
  - integration
  - app
  - ux
subject: In-app dev toolbar
---

Owner direction after seeing the [[IDEA-128]] toolbar live inside a consumer
app (func-ui, via the locally patched [[IDEA-132]] bundle). The embedded bar
is wrong on three axes — position, presence, and identity:

1. **Top, full width, in the host's layout — not an overlay.** The shipped
   shell is `position: fixed; bottom: 0`, floating over the app. It must
   instead sit at the top edge, span the full width, and occupy real layout
   space so the host app's UI starts *below* it (nothing covered, no
   overlap). Implementation-wise that means the injected element renders as a
   block at the top of the document flow (first-in-body block or sticky at
   top with body offset), not a fixed float. Panels open downward, over the
   app, from the docked strip.

2. **Always visible — no pill.** The idle collapse-to-pill state is dropped
   entirely. The bar is the permanent top strip whenever the toolbar is
   enabled; "off" is the config toggle, not an idle state.

3. **An extended StatusBar, not a copy.** The bar wears the desk StatusBar's
   visual language and carries its strip (branch, changed count,
   Sync/Push/Pull/Commit via `StatusBarCore` — [[IDEA-129]]'s seam), then
   *extends* it with the actions a developer needs while clicking through
   their own running app. Candidate extension set, drawn from IDEA-128's
   write-safe verbs (capture, reply, quick commit, run next phase, stop run):

   - **Quick capture with route context** — the original capture-in-context
     differentiator: note an idea in two sentences, current route/URL
     attached automatically.
   - **Focus** — active idea + phase, run-next-phase / stop-run inline.
   - **Scout** — reply/chat and the open-questions badge ([[IDEA-130]]).
   - **Desk** — deep link out to `/__camp` for anything deeper.

   The desk-only write-safety boundary from IDEA-128 still holds: no
   structural corpus operations (archive, plan edits, settings) from the
   embed.

Supersedes the earlier position-config framing: no `'top' | 'bottom'` option
for now — top-in-layout is the design, config can grow a knob later if a
project ever needs it.

Depends on [[IDEA-132]] landing first — layout and actions are unverifiable
while the embed's data layer can't reach the camp server.

### Thread
- [x] 2026-08-05 [decision] Toolbar is not a copy of the StatusBar but an extended version carrying the actions needed in the real app; no pill/idle state — always visible; docked top, full width, in layout above the app UI rather than overlaying it.
- [ ] 2026-08-05 [question] [agent] The extension action set is drafted from IDEA-128's write-safe verbs (quick capture with route context, focus + run/stop, scout reply + questions badge, desk link) — confirm or trim/extend the list before the plan is drafted.

### Phases
- [x] Dock the bar top, full-width, in layout
      Replace the fixed bottom shell with a first-in-flow block (or top-sticky with body offset) so the host UI starts below it, nothing covered.
- [x] Drop the idle pill; bar is always visible when enabled
- [x] Render the StatusBarCore strip inside the embed
      Reuse IDEA-129's seam for branch, changed count, Sync/Push/Pull/Commit.
- [x] Add the extension actions: Quick capture, Focus, Scout, Desk
      Panels open downward over the app; hold the desk-only write-safety boundary (no archive, plan edits, settings).
- [x] Verify layout and actions end-to-end against the camp server
