---
id: IDEA-336
title: The web wears the phone's paper
type: feat
status: done
created: 2026-11-16
updated: 2026-11-16
tags:
  - app
  - ui
  - stack
needs:
  - paper-ui/IDEA-16
  - paper-ui/IDEA-17
  - IDEA-335
subject: App UI
---

The desk is three tints of paper with a chalkboard bolted on; the phone is
one sheet. On the web the header is a parchment surface, the status bar a
kraft strip, the page a lighter paper, the Stack panel and the run output
pane a green chalkboard; the worklist rows are parchment cards 4px apart
with straight corners and Caveat group headings, and the navigation is a
row of ghost buttons in the header or, at phone width, a full-width bar on
the base colour. The phone puts everything on the ground colour under a
paper grain, draws rows as sheets 8px apart at fixed heights, labels
sections in small uppercase text, keeps run output on a kraft board, and
floats its tabs in a kraft island. paper-ui/IDEA-16 and paper-ui/IDEA-17
give folk-ui those pieces; this idea puts them on the desk.

**One ground.** `AppShell`'s header drops its parchment
`getSurfaceStyles` and the `StatusBar` its kraft `getTextureStyles`; the
`Layout` background becomes `surface.ground`, so header, status line and
page are one paper. The header becomes the phone's title row: the page
title in the title face at `2xl`, the project switcher under it in `sm`
`textSecondary` with a caret, the page's actions on the right.

**The island is the navigation.** `NavIsland` with Ideas, Activity, Chat
and Project and Feather-style icons sits inline at the right of the title
row from 481px up; at 480px and below it floats 20px above the bottom
edge and the fixed bottom bar is deleted, with
`--pc-content-pad-bottom` set from the island's height.

**Kraft where the chalk was.** The Stack panel (`stack-panel.tsx` and
its ten section files) and `run-output-pane.tsx` use `surface="kraft"`
cards and rows; the `bg-chalkboard` background image and the `desk-*`
colours leave `tailwind.config.ts`.

**Rows like the phone.** Worklist and plan rows use the sheet `Row`
with 8px gaps and the 48/56 heights; group headings and the sort header
use `SectionHeading variant="label"`; stamps and buttons already arrive
through folk-ui.

**Acceptance.** At 390px wide the Ideas page and the phone's Ideas tab
share the ground colour, row shape, row spacing, label style, stamp and
island; at 1280px the header is one paper with the island at its right
and the Stack panel is kraft, with no green left anywhere in the app.

### Phases
- [ ] One ground, title row, status line
      `AppShell` and `StatusBar` lose their surfaces, `Layout` takes `surface.ground`, the header is rebuilt as the title row; shell tests.
- [ ] The island navigates
      `NavIsland` inline in the title row above 480px and floating below it; the fixed bottom bar and its styles deleted; `--pc-content-pad-bottom` from the island; nav tests.
- [ ] Kraft boards in the Stack panel and run output
      `surface="kraft"` across `stack-panel/` and `run-output-pane.tsx`; remove `bg-chalkboard` and the `desk-*` colours from `tailwind.config.ts`; snapshot updates.
- [ ] Rows and labels
      Worklist and plan rows on the sheet `Row` with 8px gaps; `SectionHeading variant="label"` for group headings and the sort header; row tests.

### Thread
- [x] 2026-11-16 [log] [agent] Superseded on 2026-11-16 by IDEA-337 to IDEA-339: the shell, island, kraft Stack panel and rows are built in the second client at /next/ and this app stays as it is. Closed without running.
