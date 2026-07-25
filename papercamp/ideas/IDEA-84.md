---
id: IDEA-84
title: Fix header background
type: fix
status: idea
created: 2026-07-25
tags:
  - ui
  - layout
  - theme
order: 1
---

Remove background from header in the whole application. So we have full page with grid lines background paper texture.

### Phases
- [x] Locate the header background source
      The header surface comes from `Layout`'s `headerTexture="parchment"` in `src/app/router.tsx`, painted over the page's grid-lines paper background (`background={{ texture: 'speckle', ruledType: 'grid', ruledColor: 'blue' }}`). Confirm whether dropping the prop leaves paper-ui's Layout header transparent or falls back to its default speckle texture, so the fix targets the right layer.
- [x] Make the header transparent so the page texture shows through
      Remove the header's own background so the full-page grid-lines paper texture is continuous under it — either via a transparent/no-texture header option in the `Layout` prop, or an app-side override in `src/app/styles` if paper-ui always paints a default. Keep the change scoped to the header; the page background stays as-is.
- [x] Preserve header legibility and separation
      With the texture now visible behind it, ensure the header content (project identity, nav buttons, mobile sidebar toggle) stays readable and the header keeps a clear edge/separator from the content below.
- [ ] Type-check and visual pass
      `tsc --noEmit` and `biome check .` clean; confirm the header reads correctly across the plans/docs/settings areas and at the phone breakpoint where the nav moves to the fixed bottom bar.
