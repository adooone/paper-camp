---
id: IDEA-163
title: Stack panel affordance and a11y pass
type: fix
status: idea
created: 2026-08-13
updated: 2026-08-13
tags:
  - app
  - stack
  - ux
subject: App UI
---

The Stack panel's controls don't read as controls, and the panel is effectively
invisible to assistive tech. One pass over `src/app/components/stack-panel/`.

**Stale stamps have no affordance.** `checks-group.tsx` and `build-group.tsx`
map `stale` to `fillColor: 'transparent'`, `textColor: undefined`, so on load
every check renders as bare handwritten text indistinguishable from a label.
Running (amber pill) and pass (green pill) read as stamps; `stale` — the
default on every page load — reads as decoration, and the
`brightness-[1.15]` hover does nothing against a transparent fill. `stale` gets
a visible resting treatment: an outlined chalk stamp, distinct from
pass/fail/running but unmistakably a control.

**The service Run button reads as a disclosure triangle.** The `▶` on the right
of each service row starts a process, while the real disclosure — clicking the
service name — has no affordance at all. The run control gets an unambiguous
icon and the row gets a proper expand chevron.

**Services misreport state.** `app` shows a grey "stopped" dot while serving the
page you are looking at, and offers a `▶` that would start a second `pnpm dev`
on :3333. `/api/services` returns `status: stopped, health: unknown,
hasHealthcheck: true` — the healthcheck is only consulted while paper-camp owns
the process. Probe the healthcheck regardless of who spawned the service: one
answering on its port is running, and its control offers Stop or nothing rather
than Start. Fix lands in `desk-services.ts`; the panel is where it shows.

**Closed, the panel keeps 17 keyboard-focusable controls.** It is translated
off-screen with no `inert` and no `aria-hidden`; focus lands on its close button
at x≈1803 on a 1378px viewport. Mark the panel `inert` while closed.

**No structure for a screen reader.** "Stack", "Agent", "Desk", "Services",
"Checks", "Build", "CI & release" are all `div`/`span` — no headings, no
landmark role, no `aria-label` on the panel. Status dots are `aria-hidden` with
a native `title`, so their state reaches no one. The panel becomes a labelled
`complementary` landmark with real heading levels, and every dot carries text or
an `aria-label`.

**As an overlay drawer it has one exit.** Below the 1440px pin breakpoint the
panel covers 480px of content with no Escape key, no click-outside and no scrim.
Add Escape-to-close. Leave click-outside alone — the panel is a working surface
you use while reading the page behind it, and dismiss-on-click would fight that.

**Agent card labels.** `taskSubtitle` appends a kind that is often already the
plan title ("Batch reconcile — batch reconcile · Claude Code"). Title, subtitle
and agent share one ellipsis span, so the agent label truncates first and two
tasks on the same plan read identically with nothing to tell them apart. Drop
the subtitle when it restates the title, give the agent label a non-truncating
slot, and show each task's start time.

**Silent truncation.** `agentStatus.slice(0, MAX_VISIBLE_TASKS)` drops tasks
while the container is `overflow-y-auto` — it looks scrollable and isn't. Show
"+N more" linking to `/tasks`.

**Presentation.** Settle the column on left alignment (group labels are left,
"Last built" is right, the build message and empty-state cards are centred).
Luminari at `text-xs` uppercase renders mushy for the group labels ("CHECKS",
"CI & RELEASE") — use the body font at that size, per UX_PRINCIPLES §2. The
80px `h-20` header for the single word "Stack" is too much chrome on a panel
that is already short on vertical room.

Code organisation, same files and same pass:

- Four copies of the reset-button pattern; `build-group.tsx:38` and
  `checks-group.tsx:28` are byte-identical including the comment. Extract one
  `StampButton` (CODE_STYLE §3).
- `shared.ts` hardcodes six hex values that already exist as `chalk.*` in
  `tailwind.config.ts`. Keep one copy.
- `statusFill`/`statusText` are duplicated across `build-group.tsx` and
  `checks-group.tsx`, and rebuilt per render inside `agent-section.tsx` instead
  of hoisted to module scope like the other two.
- `stack-panel.tsx`'s `refreshRef` is an eight-function ref mirror reassigned on
  every render (~25 lines); `useAppStore.getState()` replaces it.
- `useDeskChecks().refresh` is never consumed.
- `ServiceLog`'s `cancelled` guard is dead when `!running` — the effect returns
  before registering its cleanup.
- No tests cover these 822 lines, the app's declared control surface. Only two
  source-text guard tests touch the file at all.

### Phases
- [x] Give stale stamps a resting treatment and consolidate the stamp code
      Add the outlined chalk resting state, extract one `StampButton`, hoist `statusFill`/`statusText` to module scope, and drop `shared.ts`'s hardcoded hex for the `chalk.*` tokens.
      run: 6m53s · 9.3k in · 17.7k out · sonnet-5
- [ ] Fix and surface service state
      Probe the healthcheck regardless of who owns the process in `desk-services.ts`, then give the row an unambiguous run icon and a real expand chevron.
- [ ] Make the panel accessible
      Mark it `inert` while closed, turn it into a labelled `complementary` landmark with real headings and dot labels, and add Escape-to-close.
- [ ] Repair the agent card and task list
      Drop the redundant subtitle, give the agent label a non-truncating slot, show each task's start time, and replace the silent slice with a "+N more" link to `/tasks`.
- [ ] Settle the presentation
      Left-align the column, use the body font for the group labels, and shrink the `h-20` header.
- [ ] Clear the dead and duplicated code
      Replace `refreshRef` with `useAppStore.getState()`, drop the unused `useDeskChecks().refresh`, and fix `ServiceLog`'s cleanup so its `cancelled` guard registers.
- [ ] Cover the panel with tests
