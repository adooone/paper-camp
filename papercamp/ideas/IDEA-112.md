---
id: IDEA-112
title: Move all styling to Tailwind
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

Styling is spread across four mechanisms — ~471 inline `style={{}}` objects, ~43 Tailwind classes, one global `utilities.css`, and paper-ui's CSS modules — so reading a component means checking several. Standardise on Tailwind utilities (paper-ui already ships the `paperPreset`, so the palette and spacing scale exist as classes).

The rules:

- Migrate every **static** inline `style={{}}` to Tailwind utility classes. Extend `tailwind.config.ts` only where a needed value isn't already in the preset.
- The **only** inline `style` that survives is a single genuinely runtime-dynamic property — a data-driven value Tailwind can't express, e.g. a `%` width/`left` computed from a rollup. Everything static becomes a class.
- Delete the `space`, `fontSize`, `radius`, `fontFamily`, and `layout` exports from `src/app/styles/tokens.ts` as their inline-style consumers move to classes; `tokens.ts` goes away entirely once `color` is gone too (see [[IDEA-111]]).
- `utilities.css` keeps only what utilities genuinely can't do: pseudo-elements, `[class*="…"]` overrides of paper-ui module classes, and media queries not expressible as Tailwind responsive variants.

Depends on [[IDEA-111]]: the CSS-var color classes must exist first, so the migration writes `text-accent-green` / `bg-canvas-300`, not fresh literals.
