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

If you build a UI that groups items into side-by-side lanes, render it through
paper-ui's `Table` with its `board` prop rather than a hand-rolled `flex` div per
column — `Table` owns the wrapper chrome, the column headers and the card
borders, so a consumer supplies only `{ key, label, accent, items, getKey,
renderItem }` per column. Nothing in `src/app` uses it today (the boards it was
written for were deleted); the prop lives in the paper-ui repo.

### Content cards use `texture="kraft"`

A default `Card` renders on the `paper` surface (`$color-bg-surface`), which is
within ~1% of the page background — so cards on a page blend in and look flat.
Give content cards `texture="kraft"` so they read as raised kraft panels against
the page. Set it via the prop, never a CSS override. Accent cards keep their
`accent`/`accentColor` — the kraft base sits under the accent glow. Stack-panel
cards are the exception: they stay `surface="chalkboard"`.

```tsx
<Card size="small" texture="kraft">…</Card>
<Card size="small" accent accentColor="amber" texture="kraft">…</Card>
```

### Primary buttons are green by default

The default `Button` (`variant="primary"`) is the app's accent green — paper-camp
themes paper-ui's brand primary through the `--pui-btn-primary` CSS vars in
`utilities.css` `:root`, which the button's fills read (see
`~/dev/paper-ui/src/components/button/button.module.scss`). So a primary/affirmative
action is just `<Button>` — no per-button styling. Use `variant="secondary"` (pale)
or `variant="ghost"` (borderless) for lesser or cancel-style actions; `variant="danger"`
for destructive ones. Never hand-color a button's fill.

```tsx
<Button onClick={…}>Create branch</Button>          {/* green, the default */}
<Button variant="secondary" onClick={…}>Cancel</Button>
```

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

Where the shared thing lands follows what it knows about: feature logic goes to
that feature's `helpers/` or `hooks/`, anything that would read the same in
another feature goes to `@/app/utils` or `@/app/hooks`.

### A feature hook may wrap a global one

When a feature needs a global hook plus its own rules, compose rather than fork.
`useDeliverCommitForm` calls `useCommitForm` from `@/app/hooks` and adds only
what plans needs — the suggested title, a `beforeCommit` that records a manual
phase, the rollback if the commit fails. The global hook stays unaware of plans,
and the feature keeps one place for its variation. Copying the global hook's body
to change three lines is the mistake this avoids.

## 4. Feature folders and service layer

Organize code like this:

```text
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

### `components/` groups by domain

A generic atom with no domain of its own (`LinkButton`, `Markdown`,
`PageTitle`) stays flat at the `components/` root. Once two or more files only
make sense together, they get a domain folder instead of sitting loose beside
the atoms: `layout/` holds the app chrome (`AppShell`, the sidebar shell, the
status bar, nav items and layout constants), `git/` holds the git-domain
surfaces (`GitStashSurface`, `GitSyncActions`, `CommitMessageFields`),
`stack-panel/` holds the Stack panel's sections. `layout/` in particular is
the *one* home for layout — a second `shell/`-style folder for chrome is the
mistake this rule prevents.

### The feature template

A feature keeps only a few anchors at its top and sorts everything else into
by-role folders, each with its own `index.ts` barrel:

```text
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
- A hook — including one used by a single component, or one that just wraps a
  global hook (§3) — always lives in `hooks/`, named `use-*.ts`. A
  `components/` or `views/` file exports components only; a hook stapled onto
  the end of one because it's only used there is how that file stops being
  something you can name.
- **Colocate tests** in a `__tests__/` subfolder inside the folder they cover
  (`helpers/__tests__/diff.test.ts`).
- Each folder's `index.ts` re-exports its files, and consumers import from the
  folder barrel (`@/app/features/plans/helpers`) — so moving a file between
  folders is an internal change. Two caveats: server-side code imports feature
  logic by **relative** path, not `@/` (the Vite config loads it at eval time
  where the alias doesn't resolve); and a cross-folder reference that would loop
  back through a barrel should import the **specific file** to avoid a cycle
  (depcruise fails the build on cycles).

### Components render, hooks decide

A component's body should read as *what it renders*. Anything else — fetching,
subscribing, deriving, sequencing async work — belongs in a hook in the feature's
`hooks/`, and the component consumes what the hook returns.

Two signals that a component has taken on work that isn't rendering:

- **More than about four store subscriptions.** A component with ten
  `useAppStore((s) => …)` selectors is coupled to the store's shape rather than
  to its own props, and can't be rendered in a test without a store. Give the
  component (or the page) one hook that reads the store and returns exactly the
  data and callbacks it uses.
- **State plus effects plus async handlers in the same body.** Three `useState`,
  two `useEffect` and a `handleSend` that awaits a service call is a hook with
  JSX stapled to it. Split it: the hook owns the state machine, the component
  owns the markup.

The JSX that remains should stay shallow. Deeply nested ternaries and inline
`.map()` callbacks that render twenty lines each are a sign a child component is
missing.

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
  Always a named interface — never an inline type literal in the parameter list.
  A component with more than a couple of props becomes unreadable as a literal,
  and the type cannot be referenced by a test or a wrapper.
- One component per file under `views/` and `components/`. A "sections" file that
  accumulates a page's parts is how a 900-line file starts.
- Table/list column definitions live outside the JSX. A `columns` array whose
  `cell` renderers are written inline nests real markup several levels deep
  inside an object literal inside a prop; give each cell a named component.
- Services: `{domain}-api.ts`, async named exports.
- Helpers: camelCase, pure where possible.
- Event handlers: `handleXxx` (e.g., `handleSubmit`, `handleTogglePhase`).
- One import statement per module. Biome sorts imports but does not merge two
  statements pulling from the same path, so this is on you.
- Imports: use `@/` aliases everywhere, including `src/app/server`; do not reach
  through `../../` more than one level. (The dev config loads the server via
  Vite's `ssrLoadModule` so `@/` resolves there too — see `vite.app.config.ts`.
  Don't reintroduce a static `import` of the server into that config; it would
  bundle the server graph in raw Node where `@/` can't resolve.)

## 6. Motion

Use `framer-motion` for:

- Route-level page transitions.
- List/feed items animating in (especially live activity feeds).
- Panel slide transitions (replacing hand-rolled `translateX` + CSS transition).

For *when* motion is warranted at all and how restrained it should be, see
"Motion" in [`UX_PRINCIPLES.md`](UX_PRINCIPLES.md).

## 7. Comments earn their place

**The code is the documentation. The default number of comments is zero.**

A comment must clear *all three* bars, or it doesn't ship:

1. It states a *why* that is genuinely **not derivable** from the code — an
   environment quirk (clipboard over non-secure origins), a spec footgun (auto
   cross-axis margins suppress flex `stretch`), a protocol shape, a security
   constraint, or a paper-ui gap (§1).
2. Rediscovering it would cost a future reader **real debugging time**.
3. It fits in **one line** (two at the absolute most).

The cap applies to a *contiguous run* of comment lines, not to a syntactic
comment: three stacked `//` lines with no code between them are one three-line
violation, not three legal comments.

Prefer the trailing form when the constraint attaches to one line —
`return h.slice(1, h.indexOf(']')); // [::1]:3333` says everything a stacked
block would, in the width the rule asks for.

**JSDoc on an exported symbol is exempt.** A `/** … */` block immediately
preceding an `export` documents that function's contract for callers who will
never read its body, and may run longer than two lines. The exemption is exactly
that narrow: a `/* … */` inside a function body is not JSDoc and is capped like
anything else. If you are tempted to write a long JSDoc on a non-exported
helper, export it or shorten it.

If you're writing a third line, you're explaining yourself, not the constraint —
delete it and put the reasoning in the commit message, where it belongs.

The bar is deliberately harsh because "explains a why" alone is too easy to
argue for: almost any prose passes it, which is how the codebase drifted to
~8% comment lines. When in doubt, delete. If the comment is load-bearing, the
next reader will feel its absence and can add one line back.

These never qualify — rename or restructure instead:

- Restating what the next line already says.
- Narrating history or a decision ("used to do X", "changed from Y", "this is
  better because") — git and the PR hold that.
- Labelling an obvious block ("// handlers", "// render") — a good name or a
  short function does that job.
- Explaining your own reasoning for a change. That is commit-message content.
- Paraphrasing a type or a prop name.

If a comment is compensating for an unclear name, rename the thing instead of
annotating it.

UX/UI principles (layout stability, visual hierarchy, motion restraint, and so
on) live in [`UX_PRINCIPLES.md`](UX_PRINCIPLES.md), not here — this file is
about how the code is written, that one is about how the UI feels to use.

## 8. The style pass

Working code is not finished code. An agent implementing a phase optimises for
making it work; nothing afterwards reads the result back against this document,
so every plan lands a little heavier than it needed to be. The **Style pass**
action in the phases list is the correction: it appends a phase that reviews the
plan's own diff against this guide and applies it.

It is scoped to the files the plan changed, never the whole codebase, and it may
not change behaviour — it ends with `pnpm check-types`, `pnpm lint` and
`npx vitest run` green and no test edited to accommodate it. A test that had to
change means the pass went too far.

### Auditing a feature folder

When passing over a whole feature rather than one diff, this is the order that
surfaced the most in the least time. Prefer measuring to reading: most of these
are one command.

1. **Line counts first.** `find . -type f | xargs wc -l | sort -rn`. The outlier
   at the top is usually the whole problem — one 900-line file, not fifty
   messy ones.
2. **Components per file.** More than one under `views/` or `components/` is a
   split waiting to happen.
3. **Store subscriptions per file.** `grep -c "useAppStore((s)"`. Five or more
   means a missing hook (§4).
4. **Inline prop literals.** `grep -n "^}: {"` finds components skipping the
   `{Component}Props` convention (§5).
5. **Duplicate imports.** Per file, `grep -o "from '[^']*'" | sort | uniq -d`.
6. **Colour and spacing literals.** `grep -n "rgba(\|#[0-9a-fA-F]\{6\}"`.
   Expect these to concentrate in one `constants.ts`; see the note below before
   planning to remove them.
7. **Comment runs over the cap** (§7), and whether each survivor states a *why*
   that the code cannot.
8. **Direct `fetch()` in components** (§4) — should be zero.
9. **Hooks outside `hooks/`.** `grep -rn "^export const use[A-Z]"
   components/ views/ actions/ modals/`. A match is a hook mis-filed next to
   the components that happen to call it (§4).

Anything a second feature would hit the same way stops being a fix and becomes a
rule in this file. That is the point of the pass.

### Known blocker: colour literals

`STATUS_ACCENT`, `STATUS_STAMP` and friends in
`features/plans/constants.ts` are raw `#hex`/`rgba()` values, which §2 forbids.
Do not "fix" them in passing. Removing them requires paper-ui to publish
`--pui-color-*-rgb` channel tokens first; the approach is settled and the
paper-ui code was written, but never released, and paper-camp's installed
paper-ui still ships no `-rgb` token. Until that publish happens, a feature's
`constants.ts` is the one sanctioned home for a colour literal, and no new
literal is added outside it.
