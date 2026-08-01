# Tailwind migration inventory (IDEA-112 phase 1)

Inventory for [[IDEA-112]] "Move all styling to Tailwind". Produced by parsing
every `style={{...}}` in `src/app` (brace-balanced extraction, deduped by
property/value). 431 inline JSX `style={{}}` objects plus ~40 named
`CSSProperties` const declarations across 55 files — matches the plan's
"~471" estimate. This document is the map later phases (2–5) execute against;
it makes no source changes itself.

## The one runtime-dynamic exception

`src/app/features/roadmap/roadmap-page.tsx` has two spots matching the plan's
stated exception ("a % width/left computed from a rollup") exactly:

- `RoadmapTimelineTrack` (~line 511): `left: `${((Date.parse(event.date) - rangeStart) / span) * 100}%`` — a timeline dot's position along a date axis.
- `RoadmapMapItem` (~line 532): `width: `${percent}%`` — a progress-fill bar's width from `item.rollup.done / item.rollup.total`.

Both are continuous, per-item values computed from data at render time —
Tailwind/JIT can't safelist infinite `%` values, so both stay inline
(`style={{ left: ... }}` / `style={{ width: ... }}`). The plan text says "a
single" property; these are two instances of the identical pattern, so both
qualify under the stated criterion — flagging rather than picking one
arbitrarily.

The `background`/`background-color` properties that ride along in those same
two style objects (`EVENT_KIND_COLOR[event.kind]`, `item.rollup.total > 0 ?
color.accentGreen : 'transparent'`) are *not* part of the exception — each
resolves to one of a small fixed set of literal colors, so they move to a
conditional/lookup class map like everything else in the "finite enum
lookups" section below.

## Layout primitives — direct 1:1 Tailwind matches, no config changes needed

`display`, `flexDirection`, `alignItems`, `justifyContent`, `flexWrap`,
`flexShrink: 0`, `minWidth: 0`, `overflow(X/Y)`, `textOverflow: ellipsis`,
`whiteSpace`, `cursor`, `fontWeight` (600/500/700 → `font-semibold`/`font-medium`/`font-bold`),
`textAlign`, `textDecoration`, `objectFit: contain`, `alignSelf: flex-start`,
`boxSizing: border-box`, `listStyle`, `position` (`sticky`/`relative`/`fixed`),
`top`/`right`/`bottom`: `0` → `inset-*-0`. All values found are already
covered by Tailwind's default utility set.

Several of these are chosen by a ternary between two *static* values
(`cursor`, `justifyContent`, `boxShadow`, `background`, `textDecoration`,
`opacity`, `alignItems`, `iconSize`'s `18`/`20`). These are not the
runtime-dynamic exception — each branch is a fixed literal — they become
conditional class strings (the existing `cn`/clsx helper) instead of a
conditional style value.

**Finite enum color lookups** (`STATUS_STAMP`, `IDEA_STATUS_STAMP`,
`PR_STATE_STAMP`, the duplicate `STATUS_STAMP` in `setup-section.tsx`,
`chalkStatusText`, `EVENT_KIND_COLOR` — all `Record<Enum, { fill, text }>` or
`Record<Enum, string>` maps of literal hex/rgba) resolve the same way: convert
each map to hold Tailwind class names instead of color values, indexed the
same way. (Several of these duplicate what paper-ui's `Stamp` component
already renders per `docs/CODE_STYLE.md` — worth a follow-up, out of scope
here.)

## `space` (tokens.ts) → Tailwind's default spacing scale, exact match

`space[1..16]` (0.25rem increments: 1,2,3,4,5,6,7,8,10,12,14,16) is byte-for-byte
Tailwind's default spacing scale — `gap`, `margin`/`marginTop`/`marginBottom`/
`marginLeft`/`marginRight`, `padding`/`paddingTop`/`paddingBottom`/`paddingLeft`
all map straight across (`gap-4`, `mb-6`, `px-3 py-2`, etc.), including
multi-value shorthand (`` `0 0 ${space[4]}` `` → `mb-4`) and negative margins
(`` `calc(-1 * ${space[5]})` `` → `-mt-5`). `layout.contentGap` (= `space[6]`)
→ `gap-6`. `LAYOUT_CONTENT_PAD` (`router.tsx`, `= 32` = `space[8]`) → `-mt-8`/
`-ml-8`/`-mr-8`. No config extension needed for this whole family.

**Off-scale values found (flag — not on the `space` scale, no systematic
reuse; use Tailwind arbitrary-value syntax rather than extending the
config):** `0.2rem`, `0.35rem`, `0.4rem` (`marginBottom`), `2px` (a `padding`
shorthand), `1.4rem` (`paddingLeft`, markdown list indent, 2 uses), `0.1em
0.35em` (badge `padding`).

## `fontSize` (tokens.ts) → not in the published preset, needs phase-2 extension

`fontSize['2xs'|'xs'|'sm'|'base'|'md'|'lg'|'xl'|'2xl'|'3xl']` has no
equivalent in Tailwind's default scale (which uses different rem values) or
in `paperPreset` (the preset never touches `fontSize`). **All 9 steps of this
scale need to be added verbatim to `tailwind.config.ts` `theme.extend.fontSize`
in phase 2**; usages then map 1:1 (`text-2xs`, `text-xs`, `text-sm`, ...).

Off-scale one-offs found: `'0.95rem'`, `'0.85em'`, `12` (px, `borderRadius`
context aside — this one is a `fontSize`), a `textSize` prop passthrough (1
use). Flag as arbitrary-value candidates (`text-[0.95rem]`) — worth a human
glance in phase 3 for whether they should just snap to the nearest scale step
instead.

## `radius` (tokens.ts) → partially covered by Tailwind defaults

- `radius.sm` (8px) = Tailwind's `rounded-lg` (0.5rem) — **exact match, no extension**.
- `radius.md` (12px) = Tailwind's `rounded-xl` (0.75rem) — **exact match, no extension**.
- `radius.lg` (20px) and `radius.xl` (28px) — **no Tailwind default; add to `theme.extend.borderRadius` in phase 2.**
- `radius.full` (9999px) = `rounded-full` — **exact match**.

Raw numeric `borderRadius` literals found directly in style objects: `6` →
`rounded-md` (6px, exact default match); `4` → `rounded` (DEFAULT, 4px, exact
match); `10` and `3` → no default match, flag (arbitrary `rounded-[10px]` /
`rounded-[3px]`, low reuse, not worth a config entry); `'50%'` → `rounded-full`
(every use found is on a square element, so visually identical); `'6px 0 0
6px'` → `rounded-l-md` (left corners only, 6px = `md`).

## `fontFamily` (tokens.ts) → already fully covered, no extension needed

Compared each local stack string against `paperPreset` and the existing
`tailwind.config.ts` extension:

- `fontFamily.serif` (`'Luminari', 'Cormorant Garamond', Georgia, serif`) = preset's `display-luminari` → **`font-display-luminari`**.
- `fontFamily.body` (`'Cormorant Garamond', Georgia, serif`) = preset's `serif` → **`font-serif`**.
- `fontFamily.handwritten` (`'Caveat', cursive`) = preset's `handwritten` → **`font-handwritten`**.
- `fontFamily.mono` (`'JetBrains Mono', monospace`) ⊂ the app's own existing `tailwind.config.ts` extension (`['JetBrains Mono', 'Fira Code', 'monospace']`) → **`font-mono`**.

All four tokens already have a matching class today; phase 2 needs no
`fontFamily` changes at all.

## `layout` (tokens.ts) → one-off pixel constants, no systematic Tailwind match

`sidebarWidth` (224), `diffSidebarWidth` (288), `stackPanelWidth` (480),
`headerHeight` (64px), `phoneBreakpoint` (480, used as a JS/CSS breakpoint,
not an inline style), `bottomNavHeight` (64) — each used in 1–2 places for one
specific container. Same treatment for the column-width constants in
`settings-page.tsx` (`TASK_COLUMN_WIDTH` 110, `AGENT_COLUMN_WIDTH` 140,
`MODEL_COLUMN_WIDTH` 160, `EFFORT_COLUMN_WIDTH` 110), `plan-rows.tsx`'s
`ROW_MARKER_WIDTH` (36), and `agent-section.tsx`'s computed
`taskStackMinHeight` (a `calc()` over constants, not runtime data — still
static). **Recommend Tailwind arbitrary-value syntax (`w-[224px]`,
`min-h-[calc(...)]`) over config extension** — none of these is a reusable
scale value, each belongs to exactly one component.

`headerHeight` is also duplicated as a hardcoded override in `utilities.css`
(per that file's own comment) — a phase-5 (`utilities.css` trim) concern, not
phase 2.

## `color` (tokens.ts) — IDEA-111 dependency never shipped

[[IDEA-111]] (adopt paper-ui's `--pui-color-*-rgb` CSS-var tokens, per its
plan write `text-accent-green` / `bg-canvas-300`) was **dropped** — it never
published past its design decision. The currently installed
`@dendelion/paper-ui@0.11.0` preset ships only `paper`/`ink`/`canvas` (50–950
scales) and `watercolor.{blue,green,amber,rose,slate}.{DEFAULT,light,dark}` —
no `accent-*` names, no CSS-var-backed classes. This inventory maps against
what is actually published, not the un-shipped IDEA-111 design:

| tokens.ts `color` | value | matches |
|---|---|---|
| `accentGreen` / `accentGreenDark` | `#8FB996` / `#5E8A66` | `watercolor-green` / `watercolor-green-dark` |
| `accentAmber` / `accentAmberDark` | `#D4A373` / `#A67B4F` | `watercolor-amber` / `watercolor-amber-dark` |
| `accentRose` / `accentRoseDark` | `#C98B8B` / `#9E5E5E` | `watercolor-rose` / `watercolor-rose-dark` |
| `accentSlate` / `accentSlateDark` | `#8A9BA8` / `#5E7080` | `watercolor-slate` / `watercolor-slate-dark` |
| `textPrimary` | `#1A1917` | `ink-900` |
| `textSecondary` | `#68635C` | `ink-500` |
| `textTertiary` | `#A8A399` | `ink-300` |

**Flag — no clean match:** `textProse` (`#1C1B18`, 2 uses) is a few RGB units
off `ink-900` (`#1A1917`); not an exact swatch. Needs a call in phase 2/3:
fold into `ink-900` or keep as a one-off config color.

**Flag — no match at all, need `theme.extend.colors` additions in phase 2**
(none of paper/ink/canvas/watercolor cover these; each is reused enough —
`deskTextMuted` alone has 9 uses — to warrant a config entry over an arbitrary
value, per this repo's "three uses means extract" rule):

- `deskBg` (`#1e3a2d`), `deskLight` (`#264a3a`), `deskText` (`#e8e4d9`), `deskTextMuted` (`#a8b5a0`), `deskBorder` (`rgba(200,210,195,0.15)`), `deskChalk` (`#d4e8cb`) — the homepage desk hero graphic's bespoke palette.
- `diffAddedBg` (`rgba(143,185,150,0.18)`), `diffRemovedBg` (`rgba(201,139,139,0.18)`) — diff-review highlight backgrounds.

**Raw hex/rgba literals found directly inline (not routed through
`tokens.ts`)** — same "no match, needs extension" treatment:
`#6A9B72`, `#A06060` (settings-page copy-state text), a family of
`rgba(0,0,0,0.04|0.05|0.06|0.08|0.12|0.15)` black-overlay tints (~8 uses
across borders/backgrounds/shadows — systematic enough to extend, not
arbitrary), `rgba(143,185,150,0.3)` / `rgba(201,139,139,0.3)` (near-duplicates
of `diffAddedBg`/`diffRemovedBg` at a different alpha — worth reconciling to
one alpha in phase 3), `rgba(214,160,160,0.6|0.9)`, `rgba(214,196,160,0.6)`,
`rgba(26,25,23,0.4)`, `rgba(61,53,43,0.12)` (border), plus the `STATUS_STAMP`-
family fill/text colors already covered under "finite enum lookups" above.

Since IDEA-111 is dropped, phase 2 cannot wait on a paper-ui republish — add
the desk/diff/overlay colors straight to this repo's `tailwind.config.ts`
`theme.extend.colors`.

## Summary: what phase 2 needs to add to `tailwind.config.ts`

- `theme.extend.fontSize`: the full 9-step scale from `tokens.ts` `fontSize` (2xs, xs, sm, base, md, lg, xl, 2xl, 3xl).
- `theme.extend.borderRadius`: `lg` (20px), `xl` (28px) only — `sm`/`md`/`full` already match Tailwind defaults.
- `theme.extend.colors`: a `desk` family (bg, light, text, textMuted, border, chalk), a `diff` family (added/removed backgrounds), the black-overlay tint family, and the handful of other one-off hex/rgba literals listed above.
- **No `fontFamily` changes** — already fully covered.
- **No `space`/spacing changes** — Tailwind's default scale already matches `tokens.ts` `space` exactly.

## Flag: needs a human call before/during phase 2–3

- `color.textProse` — fold into `ink-900` or keep as a distinct custom color?
- `diffAddedBg`/`diffRemovedBg` (0.18 alpha) vs. the near-duplicate raw
  `rgba(143,185,150,0.3)` / `rgba(201,139,139,0.3)` literals — reconcile to
  one alpha value or keep both as distinct tokens?
