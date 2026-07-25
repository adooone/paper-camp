---
id: IDEA-84
title: Fix header background
type: fix
status: in-progress
created: 2026-07-25
updated: 2026-07-25
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
- [x] Type-check and visual pass
      `tsc --noEmit` and `biome check .` clean; confirm the header reads correctly across the plans/docs/settings areas and at the phone breakpoint where the nav moves to the fixed bottom bar.
- [x] Remove every header separator so it sits flush on the page
      Supersedes the "separation" work above: the header should have no divider from the content — just logo and buttons over the continuous grid-lines texture. In `src/app/styles/utilities.css`, drop the `border-bottom` and `box-shadow` from the `header[class*="layout-module__header___"]` override (and neutralize any seam still painted by paper-ui's own header class), so there are no borders, shadows, or other separators at all.
- [ ] Trim the `@dendelion` scope from the app title
      The header project name comes from `ProjectIdentityHeader` (`src/app/components/shell/project-identity-header.tsx`), fed by `useProjectIdentity`/`fetchPackageName` (`src/app/hooks/use-project-identity.ts`), and currently renders the full scoped package name `@dendelion/…`. Strip the `@scope/` prefix so only the bare project name shows in the title.

### Log
- 2026-07-25: There should be no separators. We should have just header on top of the page. Without borders and shadows and any other separators. Just logo and buttons. Also we should trim this @dendelion section from the app title
- 2026-07-25: Applied author notes — added phases to remove all header separators (borders/shadows, superseding the earlier "separation" work) and to trim the `@dendelion` scope from the app title; set status back to in-progress.
