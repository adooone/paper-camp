---
id: IDEA-147
title: Scout panel replaces the sidesheet
type: feat
status: done
created: 2026-08-07
updated: 2026-08-11
tags:
  - integration
  - app
  - ux
  - chat
subject: In-app dev toolbar
---

The embedded island gets its name: **Scout** — we send a scout into each
host project, and [[IDEA-130]]'s conversational agent already answers to
it. With the name comes a structural simplification: the island's
slide-in sidesheet ([[IDEA-138]]'s Stack-style chat sidebar) is removed,
and everything lives in the one panel that already opens from the logo
trigger ([[IDEA-140]]) — made slightly larger, a single Scout panel.

1. **The top stripe stays exactly as it is** — branch and changed count,
   the minimal-island banner ([[IDEA-144]]).

2. **Below it, two columns.** Right, the dominant area (~two thirds):
   the Scout chat thread — the conversation IS the island's main
   feature. Left, the quick glance: idea ID stamp, current phase title,
   its status and live progress (the [[IDEA-141]] fraction), and the
   "Open Paper Camp" link out to the full desk.

3. **The sidesheet is deleted, not hidden.** Its chat folds into the
   panel; no second surface, no slide animation, no state for which
   sheet is open. One trigger, one panel, everything visible at once.

4. **Reveal behavior is unchanged** — the logo trigger opens it as
   today; only the panel's size and contents change.

### Phases
- [x] Rename the island to Scout
      Update the component names, labels, and user-facing strings.
      run: 3m40s · 20.8k in · 19.1k out · sonnet-5
- [x] Delete the slide-in sidesheet
      Remove the component, its open/close state, and the slide animation.
      run: 3m59s · 524 in · 15.3k out · sonnet-5
- [x] Enlarge the logo-trigger panel
      Keep the reveal behavior; only grow the panel's size.
      run: 1m26s · 368 in · 4.9k out · sonnet-5
- [x] Lay out the two columns under the top stripe
      Glance column left (~one third), chat right (~two thirds).
      run: 57s · 236 in · 3.6k out · sonnet-5
- [x] Fold the chat thread into the right column
      run: 5m48s · 1.3k in · 14.3k out · sonnet-5
- [x] Populate the left glance column
      Idea ID stamp, current phase title and status, live progress fraction, and the Open Paper Camp link.
      run: 6m59s · 3.4k in · 19k out · sonnet-5

### Fixes
- [x] Enlarge panel further and wrap glance column in a textured Card
      Increase the Scout panel's overall size beyond the current enlargement. Wrap the left glance column in a paper-ui Card with canvas texture. Reduce the glance column's footprint so the chat thread on the right gets more visible history.
      run: 1m24s · 5.8k in · 4.7k out · sonnet-5
- [x] Fix panel sizing and padding
      Make the panel height static (no longer content-driven). Set the left glance Card to 40% of the panel width and full height. Reduce the panel's horizontal padding so it matches the vertical padding (equal x/y).
      run: 4m15s · 6.1k in · 18.5k out · sonnet-5
- [x] Hover opens, click-outside closes
      Change the Scout panel's reveal logic: hovering the logo trigger still opens the panel, but once open it only closes on an outside click, not on mouseleave — prevents accidental pointer drift from closing the panel and losing focus/state.
      run: 1m1s · 5.7k in · 3k out · sonnet-5

### Thread
- [x] 2026-08-07 [decision] The island is named Scout, after the agent. One panel from the logo trigger holds everything — git stripe on top, glance column left, chat dominant right, desk link out; the chat sidesheet is removed entirely.
- [x] 2026-08-10 [chat] panel should be bigger and left section should be put inside Card with canvas texture. There should be more space available for viewing chat history.
- [x] 2026-08-10 [chat] [agent] Added that as a fix here — bigger panel, left glance column wrapped in a Card with canvas texture, and more breathing room for the chat history. (reopened this idea to re-run)
- [x] 2026-08-11 [chat] height of the panel should be static. And left card with idea info should be 40% of the panel width and also have full height. And we should decrease side paddings of the panel, so y and x paddings to be equal.
- [x] 2026-08-11 [chat] [agent] Added that as a fix here — static panel height, left card at 40% width with full height, and equal x/y panel padding. (reopened this idea to re-run)
- [x] 2026-08-11 [decision] Owner review of the equal-x/y padding fix surfaced two follow-ups: the git-branch banner regressed (it no longer bleeds to the card edge — the "equal x/y panel padding" phase made the banner's own negative-margin/padding symmetric too, but paper-ui's `Island` padding is actually asymmetric, `0.75rem` vertical / `1.25rem` horizontal ($space-3 $space-5) — restored the banner's margin/padding to match, so the strip nests flush again. Separately: the glance card's `justify-content: space-between` over a full-height card scattered its few lines across large, content-less gaps. Reworked to natural top-down flow with one deliberate spacer pinning the desk link / Build row to the bottom, and — since the taller panel leaves real room — added the git actions already wired in `useStatusClient` but never surfaced here (Sync/Push/Pull/Commit, icon+label, matching the desk `DeliverEmptyState`/`StatusBarCore` pattern) plus an agent-running indicator. Deliberately left out re-adding Quality/Tests/Consistency stamps — Deliver moved to the idea view in [[IDEA-146]], and duplicating it back into the embed would cut against that.
- [x] 2026-08-11 [log] [agent] The banner-nesting fix above still showed a visible seam at the top corners on owner review. Root cause: paper-ui's `Island` never sets `overflow: hidden`, so a full-bleed child's own `border-radius` can never nest exactly — it sits inset from the Island's true edge by the padding amount, and offsetting a rounded corner that way doesn't reproduce the same curve at any hand-picked radius. Fixed properly: gave the Island itself `overflow: hidden` via its `className` prop (scoped `.pc-scout-island` rule) and dropped the banner's own radius — the banner is now a plain rectangle clipped to the Island's real curve, which lines up by construction regardless of the radius token.
- [x] 2026-08-11 [log] [agent] Owner review: still not flush, on the *same* build. Pixel-measured via getBoundingClientRect/getComputedStyle in the live shadow DOM instead of re-guessing — found two compounding errors in the prior fix. (1) `scout-trigger.tsx`'s `.pc-scout-card > section` rule force-overrides the Island's padding to a uniform `0.75rem` on every side (confirmed 12px via computed style), not paper-ui's source-level asymmetric `0.75rem`/`1.25rem` the prior fix assumed — the banner's `-1.25rem` horizontal margin overshot by 8px per side. (2) Even with `overflow: hidden` clipping that overshoot, the banner (35px tall) is shorter than the Island's 28px corner radius, so its entire height sits inside the curved part of the corner — the clip boundary there is an arc, not a straight edge, so a square-cornered banner still shows a crescent of the Island's own background through both edges; not a small corner artifact, visible along the banner's full height. Real fix: matched the margin to the actual forced padding (`-0.75rem` both axes) and gave the banner its own `28px 28px 0 0` radius — identical box, identical curve, nothing left to clip. Verified via computed rects: banner and Island edges agree to within the Island's own 1px border.
- [x] 2026-08-11 [decision] Owner rejected the negative-margin/radius-matching approach outright, even once pixel-verified — too fragile, and it was: two rounds of "verified" fixes still wasn't the real issue. Direction: the Island's own `<section>` should carry no padding at all, and the padding that used to live there moves onto a wrapper *below* the banner instead. Rebuilt on that basis: `scout-trigger.tsx`'s `.pc-scout-card > section` rule now sets `padding: 0` (was force-overriding it to `0.75rem`, the actual source of both prior bugs); the banner in `scout-card.tsx` lost its negative margin entirely — it's a plain child of the now-zero-padding section, flush by construction — and a new `contentPaddingStyle` wrapper holds the `0.75rem` inset for everything below the banner (the glance card + chat columns). No negative margins anywhere in the component now. Re-verified via the same computed-rect method: banner and Island edges agree to the Island's own 1px border, `bannerMargin: "0px"`.
- [x] 2026-08-11 [decision] Idea-scoping pass on the glance card: git actions and the agent-running indicator removed — not idea-scoped, see [[IDEA-157]]/[[IDEA-158]] for git/build's actual home (the desk Stack panel). Added the plan's full title as its own line, and pushed the status stamp to the far right of the id-stamp row with a flex spacer, so the card now reads id ↔ status, then title, then current phase, then progress.
- [x] 2026-08-11 [decision] Owner asked for an even-smaller Commit button than paper-ui's existing floor (`small`/`medium`/`large`) and for the commit row's font size to match the "Open Paper Camp" link. Added a genuine new `tiny` size to paper-ui itself (Button and IconButton, `feat/tiny-button-icon-button-size` branch/worktree in the sibling paper-ui repo, linked locally into this repo to test before release) — `0.25rem 0.75rem` padding / `$font-size-xs` (12px) for Button, `32px`/`16px` icon for IconButton, one step below the existing `small` tier on the same scale. `$font-size-xs` (0.75rem) happens to be exactly the link's font size, so Commit's text now matches it for free; the commit-message Input (paper-ui has no size below `small` for it) gets a scoped `fontSize: 0.75rem` override via its forwarded `style` prop to match too.
- [x] 2026-08-11 [log] [agent] Owner reported "Open Paper Camp" not working. Traced the whole route-forwarding chain (vite plugin → script tag `data-route` → bootstrap copies it onto `<paper-camp-toolbar>` → `toolbar-element.tsx` reads it → `Toolbar`/`deskUrl`) — unchanged from before this session, and all three resolved URLs (idea page, `/diff`, route root) return 200 via curl. No definitive bug found in the link itself. Working theory: the commit section being always-visible (even with 0 changes) was cramping the fixed-height card. Made it conditional — full composer only when `changedFileCount > 0`; a centered "Push N commits" button when clean but `gitAhead > 0` (reusing `status.onPush`, already on the hook, unused here till now); a centered "Nothing to commit" message when fully synced. Should reduce content in the common case regardless of whether it was the actual cause — owner to confirm the link itself now works, not independently visually verified per their request to stop checking in Chrome.
- [x] 2026-08-11 [decision] Owner follow-up: the changed-files line is now a link too — opens the desk's `/diff` page (same route `DeliverChangedFiles` navigates to on the desk), threaded through as a new `changesUrl` prop (`${route}/diff`) alongside `deskUrl`. Switched its color to match the "Open Paper Camp" link (was muted secondary) and made it `display: block` so `text-align: center` actually centers it — an inline anchor's own text-align has no effect on its position within a flex column.
- [x] 2026-08-11 [decision] Owner follow-up: "Open Paper Camp →" moved up to sit directly under the progress bar (kept alongside "no active plan" too, so it's still always visible when no plan is focused); a centered "N files/file changed" line added above the commit input, reading `status.changedFileCount`.
- [x] 2026-08-11 [decision] Owner follow-up: tighten the gap between the commit input and the button row below it (`marginTop` 0.375rem → 0.125rem), and push the wand/suggest button to the right of the row instead of sitting flush against Commit — added a flex spacer between them, same pattern as the id/status stamp row.
- [x] 2026-08-11 [log] [agent] Linking the local paper-ui build (instead of the published npm version) silently doubled the toolbar bundle, 507kB → 708kB: a locally-linked peer dependency resolves react/react-dom from its own node_modules — a different real path than this package's copy at the same version — and Vite/Rollup dedupe by resolved path, not package identity, so both got bundled twice. Fixed in `vite.toolbar.config.ts` with `resolve.dedupe: ['react', 'react-dom']`, which forces one canonical resolution regardless of which linked package imports them; this protects any future local-linking in this repo, not just paper-ui. Bundle back to 507.64kB after the fix.
- [x] 2026-08-11 [decision] Owner added a commit composer to the bottom of the glance card, below "Open Paper Camp →": a commit-message input, a suggest button, and a Commit button — mirroring the desk's own `DeliverCommitInputRow`/`DeliverCommitButton` flow (`useAppStore`-driven there), rebuilt store-free here since the embed has no store. Extended `useStatusClient` with `suggestCommit()`/`commitWithTitle()` (additive to `StatusClientState`, doesn't touch `StatusBarCoreProps` — the desk StatusBar consuming the same hook is unaffected) alongside the existing `onQuickCommit` used there. Follow-up: suggest button moved to sit beside Commit instead of beside the input, so the input gets the full row width; Commit stays `size="small"` — paper-ui's `Button` only has small/medium/large, so that's already the smallest available.
- [x] 2026-08-11 [log] [agent] Id stamp's text looked left-misaligned against the title below it. Measured before touching anything: the stamp's own outer box was already flush at the same edge as the title (both x=445) — the offset was paper-ui's `Stamp` component's own internal padding (0.75rem horizontal, `stamp.module.scss` `.small`, for its organic blob background), pushing the "IDEA-4" glyphs 12px in from the box edge while plain text has no such padding. Not a layout bug of ours — a real property of the component. Compensated with a `margin-left: -0.75rem` scoped to just this stamp (`.pc-scout-id-stamp`), matching a value read directly from computed styles rather than assumed; doesn't touch the status stamp or the row's own alignment. Re-measured: id-stamp text and title text now start at the identical pixel.
- [x] 2026-08-11 [chat] another small fix, I want to change open/close logic - once scout panel is hovered it is opened, but to close it we will need to click outside of this panel. Currently when mouse is accidently moves out of panel it closes, and we can lost focus
- [x] 2026-08-11 [chat] [agent] Added that as a fix here — switch the open trigger to hover-to-open but click-outside-to-close, so an accidental mouse-out no longer collapses the panel and drops focus. (reopened this idea to re-run)
