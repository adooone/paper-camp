---
id: IDEA-337
title: A second desk beside the first
type: feat
status: done
created: 2026-11-16
updated: 2026-11-20
tags:
  - app
  - ui
  - settings
needs:
  - IDEA-340
subject: App UI
---

The desk should look like the phone, and the current desk should stay as
it is until the new one is better. So the new look is a second client in
this repository, served beside the first: `src/next/` with its own
`main.tsx` and `next/index.html`, a second rollup input in
`vite.app.config.ts`, reachable at `/next/` under `paper-camp dev` and the
hosted build (the daemon ships no frontend since IDEA-240). `src/app/` is not touched by this
work; both apps are built and shipped together until one is deleted.

**What the second client shares.** Everything below the view layer is
common: `src/core`, `src/types`, the server, and `src/app/services`
(`api-base`, `mount`, `hub`, `pairing-api`, `query-client`,
`machine-connection`, `runtime-connection`, `project-registry`) and
`src/app/stores`. The boot sequence of `src/app/main.tsx` (api base,
pairing, project resolution, activity stream) moves into
`src/app/services/boot.ts` and both entries call it. The new router is a
second `@tanstack/react-router` instance with `basepath` `/next` under the
mount prefix.

**folk-ui for the furniture, the phone's primitives for the look.** The
new app keeps `@dendelion/folk-ui` for containers and controls that carry
no identity: `Drawer`, `Modal`, `Table`, `Menu`, `Select`, `Input`,
`Textarea`, `Switch`, `Checkbox`, `Tabs`, `Tooltip`, `Toast`, `Skeleton`,
`Icon`, `IconButton`, `CodeBlock`, `Progress`, `Pagination`, `Accordion`,
`Disclosure`, and the Tailwind preset for layout glue. Everything that
makes the phone look like the phone is a one-to-one DOM port of
`~/dev/paper-camp-mobile/ui/`, same names and same values, in
`src/next/ui/` with CSS modules on folk-ui tokens. Three screenshots
of the phone at 2026-11-16 sit in `docs/design/phone-projects.png`,
`phone-ideas.png` and `phone-settings.png`; they are the picture every
primitive is held against: `Paper` (ground
`#ECEAE3` under the paper-noise grain at 0.3), `Hand` (the text
primitive with `font` serif/hand/mono/display and the phone's size
scale), `KraftCard` (surface fill, 1px sketch stroke, radii 18/14/20/13,
shadow 0 3px 6px at 0.08), `ListRow` and `ListLabel` (48/56 heights,
8px gap, uppercase label), `Stamp` (mono bold 11px uppercase pill with
accent border and wash), `Button` (kraft slab, outlined, ghost),
`NavIsland` (the floating 64px kraft pill with icon and label tabs),
`SubIsland` (segment pills on a white sheet), `Sheet` (bottom sheet with
scrim), `Code`, `EmptyState`, `SkeletonRows`. Boards are not kraft here:
where the phone uses `KraftBoard` for run output and logs, the second
desk uses folk-ui's chalkboard surface in its dark grey palette, so the
new app's root carries `data-chalk="grey"` and nothing green remains
(the palette comes from paper-ui/IDEA-18). The kraft
colours the phone hardcodes (`#C9B79C`, `#9C8B6F`, `#B5A185`) and the
ground live in `src/next/ui/tokens.ts` until folk-ui exports them. A
`/next/ui` route shows every primitive in every state, the page to hold
next to the phone.

**The phone's faces and Appearance.** The eight Kyiv Type files already
in `public/fonts/` get `@font-face` rules in `src/next/styles/fonts.css`;
Cormorant, Caveat and JetBrains Mono are shared with the first app. An
`appearance` slice (`textScale`, `bodyFont`, `titleFont`) persisted
under `paper-camp-appearance` with the user's phone setting as defaults (`md`,
`kyiv-sans`, `kyiv-serif`; the phone's code default is `lg`, the user
runs Default) is applied on the new app's root element as
`--next-font-body`, `--next-font-title`, `--next-font-hand`,
`--next-font-mono` and `--next-text-xs` to `--next-text-2xl` (the
phone's `textSize` times the scale), so the first app at `/` is
unaffected. folk-ui components inside the new app take the body face
once paper-ui/IDEA-15 makes folk-ui read font variables.

**Two links.** The first app's Settings page gets "Open the new desk" to
`/next/`, and the new app's Settings gets "Back to the classic desk" to
`/`; both keep the current project.

**Acceptance.** `/next/ui` renders all thirteen primitives and a grey chalkboard sample in Kyiv Sans
and Kyiv Serif at the Default scale and matches the phone's components
side by side; `/` is pixel-identical to before; `pnpm build:app` emits
both entries and Vercel serves `/next/anything` from the new entry.

### Phases
- [x] A second entry, built and served
      `next/index.html`, `src/next/main.tsx` and `src/next/router.tsx` (basepath `/next` under the mount prefix); `src/app/services/boot.ts` factored out of `main.tsx` and used by both; second input in `vite.app.config.ts`; `vercel.json` rewrite for `/next/(.*)` and a Vite dev middleware that serves the second entry; a placeholder page; smoke test for both entries.
      run: 3m49s · 60 in · 19.1k out · opus-5-5 · sess:cbc21983-8f1c-475f-b479-7540066dc3da
- [x] The phone's primitives in the DOM
      `src/next/ui/` with the thirteen primitives and `tokens.ts`, CSS modules on folk-ui tokens, values copied from `~/dev/paper-camp-mobile/ui/`; the `/next/ui` gallery route; render tests per primitive.
      run: 6m27s · 124 in · 57.1k out · opus-5-5 · sess:cbc21983-8f1c-475f-b479-7540066dc3da
- [x] Faces and Appearance
      `fonts.css` for the Kyiv files; `appearance-slice.ts` persisted under `paper-camp-appearance` with the phone's ids and `md`/`kyiv-sans`/`kyiv-serif` defaults; variables applied on the new app's root; slice tests.
      run: 2m31s · 36 in · 13.6k out · opus-5-5 · sess:87b99d70-506c-4515-bf2e-cd6dd39ad433
- [x] Links between the two desks
      "Open the new desk" in `src/app/features/settings/views/general-section.tsx`; "Back to the classic desk" in the new app's Settings placeholder; both keep the project.
      run: 1m20s · 58 in · 18.9k out · opus-5-5 · sess:87b99d70-506c-4515-bf2e-cd6dd39ad433
- [x] 2026-11-20 [log] [agent] Reviewed 2026-11-20: all four phases verified (shared boot, both entries built and rewritten, thirteen primitives matching the phone's values with 21 render tests, Appearance scoped to the new root with md/kyiv-sans/kyiv-serif, the two links). Phase 1's wording about a daemon static fallback was corrected here: the daemon has shipped no frontend since IDEA-240. Small notes for IDEA-338: `--next-font-mono` has no JetBrains Mono face on the web, and `src/next/main.tsx` ignores `resolveProject`'s hub redirect. Closing as done.
