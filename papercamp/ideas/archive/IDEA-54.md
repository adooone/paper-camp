---
id: IDEA-54
title: Default font and Stack panel cleanup
type: refactor
status: done
created: 2026-06-27
updated: 2026-06-27
tags:
  - app
  - ui
  - paper-ui
---

Made the body font the app default (Luminari reserved for display headings) and cleaned up Stack panel styling.

### Phases
- [x] Add `--paper-font-default` CSS var to paper-ui
      Sibling `paper-ui` repo: route `globals.scss`'s `body` rule and every component
      that hardcoded `font-family: $font-family-serif` (alert, list-item, select, modal,
      layout, textarea, checkbox, input, table, prop-table, navigation-island, button)
      through `var(--paper-font-default, $font-family-serif)`, mirroring the existing
      `--paper-button-font` indirection pattern; rebuilt `dist/` so paper-camp's
      `link:../paper-ui` picks it up
- [x] Set the default in paper-camp
      Added `:root { --paper-font-default: 'Cormorant Garamond', Georgia, serif; }` to
      `utilities.css` — flips every component above to the simpler font app-wide, while
      page H1s (`page-title.tsx`) and markdown headings (`markdown.tsx`) stay Luminari
      since they set `fontFamily.serif` inline, unaffected by the CSS var
- [x] Fix Stack panel button consistency
      Replaced the raw `Run tests` `<button>` with `Button variant="chalkboard"`, and
      switched the agent Send/Stop buttons from `variant="primary"` +
      `btn-violet`/`btn-orange` to `variant="chalkboard"`, matching the Lint/Format/Test
      `Stamp`s and Commit `Input`/`Textarea` already in the panel
- [x] Wrap Status and Commit in Cards; remove Active and Live
      Wrapped the Status and Commit sections in `Card variant="chalkboard" size="small"`
      to match Agent's existing card styling, and removed the "Active" (duplicated the
      Agent card) and "Live" (redundant SSE feed) sections entirely — kept the underlying
      `EventSource` subscription since it also drives the other sections' refreshes
- [x] Simplify PlanCard in the plans list
      Larger/bolder title, dropped the body/description text and the Open/Start/Stop
      buttons from the list item — Start/Stop already exist in `PlanDetail`, so no
      functionality lost — and made the whole card clickable (`role="button"`,
      keyboard-accessible) to open the plan instead
- [x] Match PlanCard's title style to PlanDetail's
      Switched the list item's title from `text-xl`/`fontWeight: 700` to the same
      `fontFamily.serif` (Luminari), `fontWeight: 600`, `1.75rem` style `PlanDetail`'s
      `<h2>` already uses, so the title reads consistently across list and detail
- [x] Reorder Stack panel to Agent → Status → Commit, each fixed-height
      Reordered the three sections (Agent now first) and changed the panel's content
      area from one scrolling column to a flex column where each section is
      `flex: 1, minHeight: 0` — so the three divide the panel's full height evenly,
      each scrolling independently (`overflowY: auto`) if its own content overflows,
      separated by a `deskBorder` divider between sections
- [x] Shrink Status to the smallest, centered section; stretch each Card full-height
      Agent/Commit are now `flex: 2`, Status `flex: 1` (smallest, still in the visual
      center between them). paper-ui's `Card` is a plain block div with no height-100%
      behavior, so added a `.stack-card-fill` utility class in `utilities.css` that
      reaches into `Card`'s two nested divs (mirroring the existing `.btn-*` SVG-path
      override pattern) to stretch it to fill its section and scroll its own content
      independently; passed via `Card`'s existing `className` prop on all three cards
- [x] Rework Status stamps to Quality/Tests/Consistency, click-to-run, centered
      Replaced the separate Lint/Format stamps with one derived "Quality" stamp
      (fail/running takes priority over the other; pass only if both pass) and dropped
      the per-stamp output-expand/`CodeBlock` behavior — clicking Quality or Tests now
      triggers that check directly instead. Genericized the test-only
      `POST /api/status/test` route into `POST /api/status/check?name=lint|format|test`
      (`status.runCheck()` already supported any `CheckName`, only the route was
      test-specific), replaced `triggerTests()`/`runTests` with `triggerCheck(name)`/
      `runCheck(name)` in `status-api.ts`/`app-store.ts`. Removed the standalone
      "Run tests" button — Tests stamp click replaces it. Quality/Tests stamps disable
      (and grey out) while either is running, since only one check job runs at a time;
      Consistency is unaffected since it's derived instantly, not a spawned job. Row is
      centered both horizontally and vertically within the now full-height Status Card
- [x] Add a real auto-fix for Quality; copy-prompt for failing Tests
      Quality is the only one of the three with a mechanical fix (`biome check . --write`
      covers both lint and format) — added `runQualityFix()` to `status.ts`,
      `POST /api/status/fix`, and a "Suggested fix: run biome --write" link under the
      stamps when Quality fails, disabled while any check is running. Tests/Consistency
      failures need judgment, not a script: added a small "Tests failing — see output, or
      [copy fix prompt]" line under the stamps when Tests fails, using a new
      `CopyPromptButton` (extracted the existing `PhaseCopyButton`'s `copyToClipboard`
      helper into `app/utils/clipboard.ts` so both share it) that copies a prompt
      embedding the captured `vitest` output. Left Consistency as-is — its existing
      per-issue clickable list already says what to check
- [x] Drop the "clean"/count suffix from the Consistency stamp label
      Now reads just "Consistency" always — state is conveyed by the stamp's fill/text
      color alone, matching Quality/Tests' plain labels. (Separately confirmed via
      curl that the running dev server's `api.ts` predates `/api/consistency`,
      `/api/status/check`, and `/api/status/fix` — all 404 until `pnpm dev` restarts;
      not a code bug in this plan's work)
- [x] Add a one-sentence failure summary above each suggested fix
      New `summarizeQualityFailure()`/`summarizeTestFailure()` (`app/utils/check-summary.ts`,
      with unit tests) parse a plain-English sentence from the check's captured output —
      `"N lint/format issue(s) found."` from biome's `Found N errors.` line,
      `"N test(s) failed."` from vitest's summary line, falling back to a generic message
      if the count isn't parseable. Shown above the existing fix link/prompt when Quality
      or Tests fails. `CopyPromptButton` gained a `variant="link"` mode (text + underline,
      matching the Quality fix link's style) for the Tests case
- [x] Stabilize the Status layout — always-present message slot, anchored to top
      The stamps row used to shift/recenter as fail messages mounted and unmounted
      (clicking the fix link visibly jumped the layout). Switched the column from
      `justifyContent: 'center'` to `'flex-start'` so the row anchors at the top, and
      replaced the two independently-conditional fail blocks with one always-mounted
      message slot below the row that renders exactly one of: "Running checks…",
      "Checks haven't run yet.", "All checks passing.", or the fail message(s) — so
      content changes in place under a fixed-position row instead of the row itself
      jumping around
- [x] Fix stamp width jump on running, and balance empty-state sections
      The Quality/Tests stamps grew wider when their `…` running suffix appeared,
      shifting the whole row — switched to always rendering the `…` with
      `visibility: hidden` when not running, reserving its width permanently instead of
      conditionally rendering it. Verified live in Chrome that "No agent running."/
      "No changed files." left a large dead gap below them in the now full-height
      Agent/Commit sections (only the populated-state content was wrapped to fill height,
      not the fallback message) — wrapped each fallback `<p>` in its own
      `flex: 1, alignItems: 'center', justifyContent: 'center'` div so it centers within
      the section's full height like the populated state does
- [x] Re-center the Status stamps/message group, fixing leftover dead space
      The `flex-start` change two phases ago anchored the stamps row to the top of the
      now full-height Status `Card`, but left a visibly large empty gap below the short
      message slot — confirmed live in Chrome (the screenshot showed Chrome's own
      flexbox-gap overlay highlighting it). The actual fix for the earlier "jump" was the
      always-rendered message slot (previous phase), not the alignment — switched back
      to `justifyContent: 'center'` so the stamps+message group centers as a unit within
      the card, with only a one-line height delta between states now that the slot never
      mounts/unmounts
- [x] Eliminate the residual jump — fixed two-line message slot, one state at a time
      Centering the group still let the stamps row shift whenever the message slot's
      own height changed (1 line running/pass/stale vs. up to 4 lines if both Quality
      and Tests failed at once — two independently-conditional blocks could both
      render). Rewrote it as a single discriminated message (priority: running >
      Quality fail > Tests fail > all-pass > stale) so exactly one state renders at a
      time, always as a primary line plus a second line that's either the fix
      link/prompt or an invisible (`visibility: hidden`) placeholder of the same
      font-size — the slot is now always exactly two lines tall, so the stamps row
      never recenters. Verified live in Chrome: triggered Tests running → pass → back
      to Quality-fail, row stayed pixel-identical throughout
