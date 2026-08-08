---
id: IDEA-144
title: Minimal island — branch banner, one glance row, single Stack button
type: fix
status: review
created: 2026-08-07
tags:
  - integration
  - app
  - ux
subject: In-app dev toolbar
---

Owner review of the v0.16.0 island ([[IDEA-140]]), tested live in func-ui.
Three corrections, being implemented against func-ui directly (local link)
before any release:

1. **The trigger isn't round.** paper-ui's `IconButton` draws an SVG blob
   background that at 56px reads as an arbitrary shape ("a little rotated
   cat head"). The trigger becomes a plain circle — kraft paper fill,
   hairline border, the logo centered — keeping the reveal animation.

2. **The island over-promises.** Capture and Chat were two buttons bound to
   the same handler (both just open the Stack panel), Desk a third
   near-duplicate — different titles, one destination. The island reduces
   to its real job, a glance plus one door:
   - **Branch banner:** full-width top strip on darker paper
     (`rgba(61,53,43,0.08)` over the kraft card) for contrast — branch
     name, ahead marker, changed/clean count.
   - **Glance row:** focus glance (`IDEA-3 · phase 1/8`), overall Checks
     stamp, then a single **Stack** button — the only action.
3. **Git verbs live in the Stack panel now.** Sync/Push/Commit moved from
   the island into the sidebar's branch/checks card, same disabled logic
   (`island-actions.tsx` deleted).

Rationale logged for the record: every content-bearing action already lives
in the Stack sidebar ([[IDEA-138]]) — capture card, chat, desk link — so
island buttons for them were three ways to say "open Stack".

### Thread
- [x] 2026-08-07 [decision] Island is glance-only with a single Stack button; branch banner full-width on darker paper; git verbs move to the Stack panel's branch card; trigger is a plain circle, not the IconButton blob.
- [x] 2026-08-07 [decision] Workflow: idea filed in paper-camp but implemented and verified against func-ui via a local link (worktree `feat/idea-144-minimal-island`) before releasing.
- [x] 2026-08-07 [log] [agent] Chat send was broken in the embed: `postFeedbackMessage` (and 51 other service call sites across 15 files — agent-api, git-api, ideas/plans/docs-api, system/*) still fetch raw `/api/...`, bypassing the IDEA-139 `apiUrl` seam, so embedded POSTs hit the host app and got HTML. Ran a codemod routing every services-layer `fetch`/`EventSource` through `apiUrl()` — this also pre-emptively fixes the relocated Sync/Push/Commit and capture-by-chat. Composer aligned with the chalkboard: `surface="chalkboard"` on Textarea, Send button, spinner, and error stamp. Verified end-to-end from the embed: message posted through the mount, landed in the corpus thread, Scout's agent replied in the panel.
- [x] 2026-08-08 [log] [agent] Island glance font was still the host's sans after the :host fix — two stacked causes. (1) A `:host` font rule loses to host-page rules that match the custom element directly (Tailwind preflight), so the shadow tree kept inheriting the host font; the font now lives on the mount node inside the shadow, unreachable by outer CSS (verified via computed styles + document.fonts). (2) The CLI dev server sent no caching headers at all, so browsers heuristically cached toolbar.js across rebuilds and kept showing stale bundles; it now sends `Cache-Control: no-cache`.
- [x] 2026-08-08 [decision] Stack minimalism round (owner): panel is chat plus exactly one card — a desk-Plans-table-style row (id stamp, title, progress bar n/m, status stamp) with a current-phase subline and an "Open in desk →" deep link; git actions and the check stamps leave the embed entirely (desk-only). Island glance typography must match paper-camp.
- [x] 2026-08-08 [log] [agent] Root cause of every embed font/color drift found while doing the above: paper-ui declares all --pui-* custom properties and the desk sets its body font on :root, which never matches inside a shadow tree — every var() silently fell back to host-page values. Fixed by re-scoping the injected stylesheet (:root → :root, :host) and setting the body font on :host. Also: Card's non-chalkboard surfaces set no text color (canvas card inherited the panel's chalk white — invisible text), fixed with explicit ink in the plan-row card.
- [x] 2026-08-07 [decision] Stack panel parity round (owner review of the embed vs the desk): panel wears the desk Stack surface (noise over the `#264a3a→#1e3a2d` gradient, so `#142e22` cards sit visibly darker); side panel spans full viewport height (dropped the stale `top: 2rem` bar offset); git buttons become `surface="chalkboard"` with Merge/Push icons matching the Deliver card; Quick capture card removed — chat covers capture; "Open full desk" moves directly under the idea header; the embed injects the desk's Google-Fonts link into the host head, since @font-face never crosses into shadow DOM on its own.

### Phases
- [x] Round the trigger
      Replace the IconButton blob with a circular kraft-paper button, hover ring, reveal animation intact.
- [x] Collapse the island to banner + glance row
      Full-width darker-paper branch banner; one row with focus glance, Checks stamp, single Stack button; delete island-actions.
- [x] Move git verbs into the Stack panel
      Sync/Push/Commit on the sidebar's branch/checks card with the same disabled logic.
- [x] Verify linked against func-ui
      Local link into func-ui, browser pass over trigger, island, Stack actions; then type-check and tests.
