---
id: IDEA-186
title: Use the whole width
type: feat
status: review
created: 2026-08-17
updated: 2026-08-17
tags:
  - app
  - ui
  - layout
subject: App UI
---

The shell wastes horizontal space at every width below 1440px, and the page stops
short of the bottom edge instead of running under it.

### The good layout already exists — it is gated

`router.tsx`'s `isLarge` (`min-width: 1440px`) switches three things at once:

- the content column becomes `flex-[1_1_0%]` instead of `flex-[0_1_800px]`
- `Page` gains `max-w-none`, dropping the 800px cap
- the root reserves the panel's width with `min-[1440px]:pr-[480px]`, so the
  Stack docks instead of overlaying

Above 1440 that is exactly the wanted layout. Below it, everything inverts:
the page is capped and centred, and the Stack becomes an overlay.

Measured at a 1200px viewport:

| band | px | |
|----|----|----|
| left margin | 0 – 75 | unused |
| sidebar | 75 – 300 | |
| gap | 300 – 325 | unused |
| page | 325 – 1125 | capped at 800 |
| right margin | 1125 – 1200 | unused |

The header spans the full 0 – 1200 across all of it, so it visibly fails to line
up with the sheet beneath — the misalignment is the cap, not the header.

There is room for the docked layout at this width: sidebar 225 + Stack 480
leaves ~495 for the page.

### Fill the width

Sidebar left, page centre, Stack right, edge to edge, with no centring gutters
and no 800px cap. The three-column shell becomes the default rather than a
large-screen reward.

Lower the breakpoint to where three columns genuinely fit rather than deleting
it — the drawer behaviour still has to survive narrow widths. Derive the
threshold from the real minimum page width instead of picking a round number:
sidebar + minimum readable page + Stack. By the arithmetic above that lands near
1200, which is exactly the width this was reported at.

`max-w-none` and `flex-[1_1_0%]` stop being conditional. The `800px` basis goes.

### Let the page run under the bottom edge

Only the content scrolls — that invariant holds today and is guarded by
`chrome-outside-scroll.guard.test.ts`. What is missing is the visual cue: the
sheet ends above the fold with padding beneath it, so a short page looks
finished and a long one gives no hint that more follows.

The sheet should bleed past the bottom of the viewport at any content height, so
there is always the suggestion of something below. `Layout` already receives
`bleedBottom`; the two knobs that fight it are `Page`'s
`min-h-[calc(100vh-160px)]` and the scroller's
`pb-[var(--pc-content-pad-bottom,32px)]`. Keep the phone-breakpoint bottom
padding — it clears the fixed bottom nav and is load-bearing there.

### Out of scope

The Stack panel's own internals ([[IDEA-163]]), the nav island, and what the
sidebar contains per route. This is the shell's column geometry only.

### Phases
- [x] Derive the three-column breakpoint from real widths
      sidebar + minimum readable page + Stack, landing near 1200 — a named
      constant, not a round number.
      run: 2m7s · 6.8k in · 8.6k out · sonnet-5
- [x] Lower `isLarge` to that threshold in `router.tsx`
      run: 46s · 238 in · 1.9k out · sonnet-5
- [x] Make the docked three-column layout unconditional
      Drop the `flex-[0_1_800px]` basis and un-gate `max-w-none` and
      `flex-[1_1_0%]`; keep the narrow-width drawer fallback.
      run: 40s · 355 in · 2k out · sonnet-5
- [x] Bleed the sheet past the bottom edge
      Relax `Page`'s `min-h-[calc(100vh-160px)]` and the scroller's
      `pb` so short and long pages both run under the fold, preserving the
      phone-breakpoint bottom padding.
      run: 2m36s · 388 in · 11.5k out · sonnet-5
- [x] Confirm the scroll and alignment guards still pass
      run: 2m15s · 362 in · 1.5k out · sonnet-5

### Fixes
- [x] [manual] Add the no-wrap rule to UX_PRINCIPLES §1
      Control rows never wrap to a second line — shorten the label, drop to an icon, then move to an overflow. Priority goes to what the user reads or types, not what they click.
- [x] Scale the Stack width with the viewport
      At a 1200px viewport the columns measure sidebar 282 / page 407 / Stack 480 — the ambient panel is wider than the work. Replace the fixed `w-[min(480px,100vw)]` with a clamped width that keeps 480 where there is room and yields first when width is scarce, so the page takes the surplus. The literal is stated three times (the panel's class, the root wrapper's `min-[1199px]:pr-[480px]`, and the comment tying them together); a scaling width needs one definition both read or they will drift.
      run: 3m29s · 5.8k in · 16k out · sonnet-5
- [x] Stop the phases table overlapping itself
      A phase title's right edge sits 63px past where its run-metadata begins — `Derive the three-column breakp…` ends at x=477 while `15.4k tokens · 2m7s · sonnet-5` starts at x=414, so the two render on top of each other. The title cell is 113px holding text needing ~180. Give the title a min-width floor and shed the metadata in a defined order — tokens, then duration, then model — moving it behind the row's disclosure below a floor.
      run: 8m54s · 1k in · 31.5k out · sonnet-5
- [x] Give the commit input priority over the button
      Measured at 1200px: the commit title input is 26px wide beside a 272px Commit button, a ratio of 10.5×. The input takes the row's flexible width with a real minimum; the button sizes to its content and becomes an icon button with its label in the tooltip below a floor. A commit title you cannot read produces a worse commit message than a button you cannot read a label on.
      run: 5m10s · 4.2k in · 23k out · sonnet-5
- [x] Stop the idea-view header wrapping
      Refresh sits top-right at a wide viewport and drops to a second line at a narrow one, moving a control whose position the user has learned. The header row never wraps: labels shorten, then collapse to icons, then the least-used actions move behind the existing overflow menu.
      run: 3m6s · 302 in · 13.6k out · sonnet-5
- [x] Collapse the Deliver checks into one Health stamp
      Quality, Tests, Consistency, Docs, a stash count and a commit state render as separate stamps that wrap across rows at a 407px page width, growing the section downward while almost always saying 'everything is fine'. One Health stamp: green when all pass, carrying the failing count when not, expanding to the individual checks on click so detail is one interaction away. Matches the Stack panel's own Health section, so the two surfaces stop disagreeing.
      run: 4m43s · 433 in · 16.6k out · sonnet-5
- [x] Give the Stack three widths, not a continuous clamp
      The scale fix landed `--pc-stack-width: clamp(320px, 100vw - 879px, 480px)` in `utilities.css`, so the panel resizes on every pixel of viewport change — the width is never the same twice and nothing settles. Replace it with three discrete steps: full width below the phone breakpoint, 60% of today's 480px (288px) at medium, and 480px at large. Derive the large threshold the way phase 1 derived the three-column breakpoint rather than picking a round number. At 1200px this gives sidebar 282 + Stack 288, leaving the page ~630 instead of 407.
      run: 3m52s · 5.8k in · 20.1k out · sonnet-5
- [x] Show only tokens in a phase row below large
      Refines the shed order already shipped: instead of dropping duration then model as space tightens, show the full `15.4k tokens · 2m7s · sonnet-5` triplet only at the largest width and just the token count at small and medium. One rule, one breakpoint, no intermediate states to reason about.
      run: 1m26s · 159 in · 5.9k out · sonnet-5
- [x] Make agent rows a fixed two-line card
      Measured in Chrome — the broken card is the agent row, and the cause is inverted shrink priority. IDEA-163's 'non-truncating slot' for the agent label made the metadata unshrinkable, so the plan title absorbs 100% of the loss: at a 316px panel the title box is 21px holding 259px of overflow, and on the running row it measures 0px wide while `· Claude Code` keeps 82px and the timestamp 61px. Even at a 476px panel the title still overflows by 74-144px. Card heights differ too — 57/48/48 at 316px — because content drives height. Fix: the title gets the flexible width with a real minimum and the metadata shrinks first, per the UX_PRINCIPLES §1 rule that priority goes to what the user reads. Every row is the same fixed height at every width: line one the title, line two agent, time and status, in a denser size. `MAX_VISIBLE_TASKS` stays 3. Remove the `+N more` link.
      run: 3m53s · 435 in · 13.3k out · sonnet-5
- [x] Fold Health into the checks, inline
      The panel carries two separate check surfaces: the Desk's CHECKS group (types/lint/test/build) and a 153-line `health-section.tsx` mounted as its own top-level section with an `h3` and doctor/docs stamps. Two labelled sections for one question — is anything wrong — and neither says what it is for. Render them as one inline row of stamps within Desk, drop the standalone Health section and its heading, and keep the expand-on-click detail.
      run: 3m28s · 4.1k in · 14.4k out · sonnet-5
- [x] Size the agent card to its two-line content
      The fixed-height card is 55px but its content needs 74px, and the Card's border layer is `overflow-y: hidden`, so 19px is cut and unreachable. Measured inside one card: the metadata line `Claude Code · 15:18:51` runs from y=42 to y=57 and the `done` stamp from y=38 to y=61, against an inner box ending at 55 — both are clipped, which is why the stamp reads as overlapping the metadata. Uniform height is right; the number is wrong. Derive it from the two-line content plus padding rather than picking one, and never let the card clip its own rows.
      run: 2m9s · 5.8k in · 8k out · sonnet-5
- [x] Give the panel one scroll region, not a nested Desk scroller
      The panel body is split into a `flex-none` Agent block (272px, fixed) and a `flex-1 overflow-y-auto` Desk block (508px visible, 572px content) — so the Desk scrolls independently inside a panel that already sits in a scrolling page. Agent and Desk scroll together as one region below the fixed Stack header instead. Note this revises [[IDEA-161]], which added `overflow-y-auto` to the Desk wrapper because content was being clipped and unreachable — the answer is to move the scroll up, not to remove it and go back to clipping. With the width, token and health compaction already queued, 572px should fall under the available height at most sizes so it rarely scrolls at all.
      run: 47s · 149 in · 2.4k out · sonnet-5
- [x] Split the Deliver section strictly 50/50
      `entity-detail.tsx`'s DeliverSection is `md:flex-row` with a left column at `flex-1` and a right column carrying no flex at all, so the right sizes to its content and the divider lands wherever that content happens to end — the split changes with the button label, the file count and the empty state. Give both columns an equal basis so the divider sits at the midpoint at every width and in every state.
      run: 32s · 145 in · 1.1k out · sonnet-5
- [x] Remove the commit message field and its Add-a-message toggle
      `components/commit-message-fields.tsx` renders a `Textarea` behind an `Add a message` toggle (`bodyExpanded`). This came out of [[IDEA-165]], which proposed it after I found `commitMessage` was held in state but never rendered — it was my inference, not a request. Remove the toggle and the body field; the commit title stays. `commitMessage` itself can stay in the form state for the agent-suggested path to populate, but nothing renders it and nothing asks for it by hand. Deliberate removal: do not reinstate it as a fix for an 'uneditable commit body'.
      run: 40s · 280 in · 2k out · sonnet-5
- [ ] Close the gap between a phase title and its usage
      The Phases table gives the title column `width: 6` against a `width: 1` checkbox and an end-aligned actions column, so the title cell is far wider than its text and the run metadata is pushed hard right — leaving a large dead gap mid-row that makes the two read as unrelated. Size the title to its content and let the usage sit next to it rather than at the far edge, so the row reads as one line.

### Thread
- [x] 2026-08-17 [review] [agent] Approves · 0 findings — The diff faithfully implements the idea: it derives a three-column breakpoint (224+495+480=1199) from named constants, lowers the media query and the paired Tailwind literal to it, un-gates `flex-[1_1_0%]`/`max-w-none` and drops the 800px basis, and relaxes both bleed knobs (Page min-height and the scroller's bottom padding). All five phases are actually reflected in the code, and nothing contradicts the spec. The `isLarge` variable remains in use for the docked sidebar, so removing its two style ternaries leaves no dead references.
