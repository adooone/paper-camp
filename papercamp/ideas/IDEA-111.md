---
id: IDEA-111
title: Single-source color tokens via CSS variables
type: refactor
status: idea
created: 2026-07-30
updated: 2026-07-30
tags:
  - app
  - ui
  - refactor
subject: Simplicity pass
---

Every color is defined three times — paper-ui's scss tokens (`_tokens.scss`), paper-ui's Tailwind preset (`colors`), and a hand-typed `color` object in `src/app/styles/tokens.ts` — plus ~47 raw `#hex`/`rgba()` literals inline in TSX. The same accent green exists as `#8FB996` solid and as `rgba(143,185,150,0.25)` (the header tab), with no shared name, which is why picking "the green" keeps going wrong.

Make CSS custom properties the one source:

- **paper-ui**: declare the full palette as `--pui-color-*` custom properties in `globals.scss`, and rewrite both the scss tokens and the Tailwind preset to reference them — e.g. `$color-accent-green: var(--pui-color-accent-green)` and the preset's `colors['accent-green'] = 'var(--pui-color-accent-green)'`. Add named entries for the alpha variants too (`--pui-color-accent-green-25`, `-30`) so the header green has a real name. This extends the `--pui-btn-primary` seam already shipped; it needs a paper-ui version bump.
- **paper-camp**: delete the `color` export from `tokens.ts`, and replace all ~47 inline `#hex`/`rgba()` literals with Tailwind color classes (or `[…:var(--pui-color-…)]` arbitrary values). No hand-typed color literal remains in the app.

Result: one place to define or retheme any color, no duplicate-hex drift. Foundation for [[IDEA-112]] — do this first so the color classes/vars exist before the Tailwind migration.
