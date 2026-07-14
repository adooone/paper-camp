# paper-camp UI code style guide

This document is the source of truth for how UI code in `src/app` is written. It
captures the rules the project already follows implicitly and the ones this
cleanup pass is bringing into line.

## 1. Use paper-ui components by default

The dashboard is built on top of `@dendelion/paper-ui`. Reach for a paper-ui
component before writing raw HTML.

- Buttons → `Button` or `IconButton`
- Inputs → `Input`, `Textarea`, `Checkbox`
- Layout surfaces → `Card`, `Layout`, `Page`, `Island`
- Status → `Stamp`, `Progress`
- Lists → `ListItem`
- Tabular data → `Table`
- Lane/column boards (Kanban-style, grouped cards) → `Table` with its `board`
  prop, not hand-rolled flex divs
- Overlays → `Modal`, `Alert`
- Code → `CodeBlock`

If paper-ui has no equivalent for what you need, use raw HTML and add an inline
comment explaining the gap. Do not build a workaround component locally unless the
gap is approved as a real paper-ui addition.

Known gaps that are intentionally raw:

- `<input type="file">` hidden trigger in `settings-page.tsx` — paper-ui has no
  file-input abstraction.

### Lane/column boards use `Table`'s `board` prop

Any UI that groups items into side-by-side lanes (the Kanban board, the Ideas
Planned/Done board) renders through paper-ui's `Table` component with its
`board` prop, not a hand-rolled `display: flex` div per column. `Table` owns
the wrapper border/shadow/paper-texture, the column header chrome (label +
count badge, accent-colored bottom border), and the per-card border/background
— so a board consumer only supplies `{ key, label, accent, items, getKey,
renderItem }` per column and a `renderItem` that returns the card's *inner*
content (no outer border/background of its own; `Table` draws that).

See [`board-view.tsx`](src/app/features/plans/components/board-view.tsx) and
[`ideas-board.tsx`](src/app/features/plans/components/ideas-board.tsx) for the
canonical usage. The `board` prop itself lives in the paper-ui repo
(`~/dev/paper-ui/src/components/table/table.tsx`) — see "Working with the
paper-ui sibling repo" in `AGENTS.md` before touching it.

## 2. Design tokens, not literals

paper-ui owns the design tokens. Do not hand-type font stacks, spacing values,
colors, or transitions in `src/app`.

### Fonts

paper-ui's own default for body text/buttons/most components is Luminari
(`fontFamily.serif`) — paper-camp overrides that default to the simpler body font
via `--paper-font-default` (set once in `src/app/styles/utilities.css`), so most
text does not need an explicit `fontFamily` at all.

- Serif/title: `'Luminari', 'Cormorant Garamond', Georgia, serif`. Use this
  explicitly (inline `fontFamily: fontFamily.serif`) only for page H1s
  (`page-title.tsx`), markdown headings (`markdown.tsx`), and other deliberate
  "special title" moments — these are the only things still meant to read as
  Luminari.
- Body (the project-wide default): `'Cormorant Garamond', Georgia, serif`. Most
  text gets this for free via `--paper-font-default`; do not add a redundant
  inline override.
- Handwritten: `'Caveat', cursive`.
- Mono: `'JetBrains Mono', monospace`.

Do not invent new stacks. If you need a paper-ui component's default font
changed project-wide, add to the `--paper-font-default` indirection in the
sibling `paper-ui` repo (see `globals.scss`/`button.module.scss` for the
pattern) rather than fighting it with per-instance overrides in `src/app`.

### Spacing

paper-ui's spacing scale is the source of truth:

```
$space-1:  0.25rem
$space-2:  0.5rem
$space-3:  0.75rem
$space-4:  1rem
$space-5:  1.25rem
$space-6:  1.5rem
$space-7:  1.75rem
$space-8:  2rem
$space-10: 2.5rem
$space-12: 3rem
$space-14: 3.5rem
$space-16: 4rem
```

Because paper-ui does not expose the full token set as CSS custom properties,
`src/app` mirrors the tokens in one local constants file (`src/app/styles/tokens.ts`).
Import from there; do not duplicate the values inline.

### Colors and transitions

Use paper-ui tokens where exposed (`--pui-bg-base`, `--pui-bg-surface`,
`--pui-text-primary`, `--pui-text-secondary`). For other colors, mirror the
paper-ui `_tokens.scss` values in `src/app/styles/tokens.ts` rather than copying
hex codes. Transitions should use the paper-ui timing values (`150ms`, `200ms`,
`300ms`) with `ease-out` / `cubic-bezier(0.4, 0, 0.2, 1)`.

Components that take a named accent (`Card`'s `accentColor`, `Table`'s `board[].accent`)
only accept the fixed palette `'blue' | 'green' | 'amber' | 'rose' | 'slate'` —
never pass a raw hex/rgba to these props. `constants.ts`'s `STATUS_ACCENT` is
the existing `PlanStatus -> accent` mapping; reuse it (or extend it) instead of
inventing a parallel hex-keyed map like the old `KANBAN_COLUMNS.accent` was.

## 3. Three copies means extract

This project avoids premature abstraction, but repetition is not free. If the
same logic, style object, or fetch pattern appears three times, extract it.

Examples already in flight:

- `useProjectIdentity()` — consolidates the icon + project-name fetch that was
  copied in five places.
- `LinkButton` — consolidates the inline "link button" style repeated in
  decision/question detail views.

## 4. Feature folders and service layer

Organize code like this:

```
src/app/
  components/        # Cross-cutting UI used by >1 feature (Markdown, PageTitle, StackPanel)
  features/          # One folder per route-level feature (see the feature template below)
    plans/
    docs/
    settings/
  server/            # Dev-server middleware / SSE / API routes
  services/          # Client-side API callers
  stores/            # Zustand stores
  styles/            # Tailwind entry + token mirror
```

Rules:

- `features/` owns route-level screens and their local code.
- `services/` owns all `fetch()` calls to `/api/*`. Components do not call
  `fetch()` directly.
- top-level `components/` is only for pieces used by more than one feature.
- Each feature, and each of `components/`, `services/`, and `stores/`, has an
  `index.ts` barrel file.

### The feature template

A feature keeps only a few anchors at its top and sorts everything else into
by-role folders, each with its own `index.ts` barrel:

```
features/plans/
  plans-page.tsx     # the route entry ({feature}-page.tsx)
  index.ts           # public barrel
  constants.ts       # feature-wide constants (an anchor when used across the feature)
  hooks/             # React hooks (use-*.ts)
  helpers/           # pure feature logic (selectors, parsers, similarity, diff, …)
  prompts/           # feature-specific agent prompt builders (if any)
  views/             # composed, page-level view components
  modals/            # dialog components
  actions/           # small action components (the *-button.tsx family)
  components/         # shared UI atoms local to the feature (stamps, bars, …)
```

- **Anchors** at the top: the `index.ts` barrel, the `{feature}-page.tsx`
  entry, styles, and genuinely feature-wide files (e.g. `constants.ts`).
  Nothing else sits loose at the feature root.
- **By-role folders** hold everything else. `hooks/`, `helpers/`, `prompts/`,
  `views/`, `modals/`, `actions/`, `components/` are the standard buckets — add
  one only once it has members. (A vague `utils/` junk-drawer is not a role: if
  you can't say what a file *is*, don't group it yet.)
- **Colocate tests** in a `__tests__/` subfolder inside the folder they cover
  (`helpers/__tests__/diff.test.ts`).
- Each folder's `index.ts` re-exports its files, and consumers import from the
  folder barrel (`@/app/features/plans/helpers`) — so moving a file between
  folders is an internal change. Two caveats: server-side code imports feature
  logic by **relative** path, not `@/` (the Vite config loads it at eval time
  where the alias doesn't resolve); and a cross-folder reference that would loop
  back through a barrel should import the **specific file** to avoid a cycle
  (depcruise fails the build on cycles).

### Non-feature modules group by domain

Outside `features/`, the same anchors-plus-subfolders idea applies, but the
subfolders are named for the **domain** of logic rather than its role:
`core/` → `parse/`, `serialize/`, `git-pr/`, `status/`; `server/routes/` →
`content/`, `system/`. Same barrel-and-anchor rules; `@/core` / `@/app/services`
consumers stay unchanged.

**Soft ceiling:** once a folder passes ~8–10 files (anchors included), group.
Below that, flat is the more readable choice — `docs/` and `settings/` stay as
`{feature}-page.tsx + index.ts + components/`. Don't group pre-emptively.

## 5. Naming and formatting

- Biome is the formatter/linter. Run `pnpm lint` and `pnpm lint:write`.
- Components: PascalCase, named export, props interface named `{Component}Props`.
- Services: `{domain}-api.ts`, async named exports.
- Helpers: camelCase, pure where possible.
- Event handlers: `handleXxx` (e.g., `handleSubmit`, `handleTogglePhase`).
- Imports: use `@/` aliases; do not reach through `../../` more than one level.

## 6. Motion

Use `framer-motion` for:

- Route-level page transitions.
- List/feed items animating in (especially live activity feeds).
- Panel slide transitions (replacing hand-rolled `translateX` + CSS transition).

For *when* motion is warranted at all and how restrained it should be, see
"Motion" in [`UX_PRINCIPLES.md`](UX_PRINCIPLES.md).

## 7. Comments earn their place

A comment must explain a *why* that isn't derivable from the code: an
environment quirk (e.g., clipboard over non-secure origins), a non-obvious
protocol shape, a security or correctness rationale, or a paper-ui gap (§1).
If none of those apply, don't write it.

These do not qualify, and should be a rename instead:

- Restating what the next line already says.
- Narrating history ("used to do X", "changed from Y") — git and
  `papercamp/progress.md` hold that.
- Labelling an obvious block ("// handlers", "// render") — a good name or a
  short function does that job.

If a comment is compensating for an unclear name, rename the thing instead of
annotating it.

UX/UI principles (layout stability, visual hierarchy, motion restraint, and so
on) live in [`UX_PRINCIPLES.md`](UX_PRINCIPLES.md), not here — this file is
about how the code is written, that one is about how the UI feels to use.
