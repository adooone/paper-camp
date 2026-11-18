---
id: IDEA-335
title: Appearance settings on the web
type: feat
status: done
created: 2026-11-16
updated: 2026-11-16
tags:
  - app
  - ui
  - settings
needs:
  - paper-ui/IDEA-15
subject: App UI
---

The desk cannot change its typeface and the phone can. The phone's
Appearance setting picks a body face (Cormorant, Kyiv Sans, Kyiv Serif),
a title face (Luminari, Kyiv Titling, Kyiv Serif, Kyiv Sans) and a text
scale (0.9, 1, 1.15, 1.3), with Kyiv Sans, Kyiv Serif and the 1.15 scale
as the defaults the user likes. The web is fixed on Cormorant Garamond
for body text, Luminari for page titles and the app name, and Caveat in
35 files for counts, meta lines, section headings, stamp text and Stack
panel labels; the phone barely uses Caveat at all. With paper-ui/IDEA-15
every folk-ui face is a CSS variable, so the desk only has to set four
variables and a root size.

**The same setting, the same defaults.** An `appearance` slice
(`textScale`, `bodyFont`, `titleFont`) persisted in `localStorage` under
`paper-camp-appearance`, defaulting to `lg`, `kyiv-sans`, `kyiv-serif`.
`AppShell` writes `--paper-font-default`, `--paper-font-title`,
`--paper-font-hand`, `--paper-font-mono` and the root `font-size`
(17px times the scale) on `<html>`. The eight Kyiv Type faces (OFL) the
phone ships are in `public/fonts/` with `@font-face` rules in
`utilities.css`; Cormorant and Caveat stay for the choices that use them.

**Settings gets Appearance.** A section under General mirroring the
phone's: a text-scale segmented control, a body-face list and a
title-face list, each row previewing its face, applied live.

**Caveat retires.** Every `font-handwritten` site becomes one of three
things: counts and meta lines become the body face at `sm` or `xs` in
`textSecondary`; section and group headings become folk-ui's
`SectionHeading variant="label"` (paper-ui/IDEA-16) or, until that
lands, `text-sm font-semibold uppercase tracking-[0.4px]`; the run-order
number inside a stamp becomes the stamp's own mono. The `font-handwritten`
utility and the Caveat `@font-face` rules stay only for the `hand`
variable's fallback. Luminari leaves the page titles and the app name,
which use the title face.

**Acceptance.** A fresh profile shows Kyiv Sans body and Kyiv Serif
titles at the Large scale, the same as a fresh phone. Changing the body
face in Settings restyles every page without reload and survives a
reload. `grep -r font-handwritten src/app` finds nothing.

### Phases
- [ ] Faces hosted and the appearance slice
      Eight `@font-face` rules for the Kyiv files in `public/fonts/`; `appearance-slice.ts` with the phone's ids and defaults persisted under `paper-camp-appearance`; `AppShell` sets the four variables and the root size; slice tests.
- [ ] Appearance in Settings
      `appearance-section.tsx` under General with the text-scale control and the two face lists previewing their faces; view test.
- [ ] Caveat retires
      Replace every `font-handwritten` use per the body's three rules; page titles and the app name on the title face; delete the utility's remaining uses and update snapshots.

### Thread
- [x] 2026-11-16 [log] [agent] Superseded on 2026-11-16 by IDEA-337, which builds the phone's look as a second client at /next/ instead of changing this app; the Appearance setting and the Kyiv faces moved into IDEA-337. Closed without running.
