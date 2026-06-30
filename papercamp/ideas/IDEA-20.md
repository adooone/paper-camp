---
id: IDEA-20
title: Plan storage architecture
---

### IDEA-20: Plan storage architecture

`plans.md` is one monolithic file holding every plan ever created, `done` or not — already 1045 lines / 23 of 26 plans closed, and it only grows. At this project's actual stated goal — many plans/fixes over time, managed mostly by AI agents working sequentially or on branches — a single growing file becomes expensive in three concrete ways: every agent read costs the whole file even when it cares about one plan, the hand-rolled line parser (`core/parser.ts`, which already emits non-fatal warnings on malformed entries) gets more fragile the more entries it has to scan, and two branches editing two different plans still collide on the same file's line ranges. `ideas.md` has the identical shape and will hit the identical wall.

**Core change: one file per plan/idea, not one file per project — and one visible folder, not two.** This also folds in dropping `.paper-camp/` (config/assets) into the now-restructured `papercamp/`, since the directory restructure is the natural moment to fix that too:

```
papercamp/
├── about.md              # technical reference — stays one file, prose
├── decisions.md           # decision log — stays one file, append-only
├── open-questions.md      # open questions — stays one file, append-only-ish
├── progress.md             # changelog — stays one file, append-only timeline
├── config.json             # moved from .paper-camp/ — machine config (nextId counters, defaultAgent, port, projectName)
├── assets/
│   └── icon.svg             # moved from .paper-camp/assets/
├── plans/
│   ├── index.md              # generated — id/title/status/tags only, never hand-edited
│   ├── feat-17.md             # YAML frontmatter (id/status/kind/tags/dates/idea/agent) + body (description/phases/log)
│   ├── feat-20.md
│   ├── fix-3.md
│   └── archive/
│       ├── feat-1.md           # moved here verbatim once Status → done/dropped, no rewrite
│       └── feat-2.md
└── ideas/
    ├── index.md                # generated — id/title only
    ├── idea-1.md
    └── idea-17.md
```

`about.md`/`decisions.md`/`open-questions.md`/`progress.md` stay exactly where they are, untouched — they're read as a log/reference, not scanned for "what's active," so the per-file/bloat argument doesn't apply to them. `archive/` sits inside `plans/`, not as a sibling, since a closed plan is still conceptually a plan, just inactive; `ideas/` gets no equivalent archive folder since ideas don't "close" the same way a plan does (a done idea just has a linked done plan — the idea entry's own shape doesn't change).

This alone fixes the cross-branch conflict problem structurally (two branches touching two different plans now touch two different files, not two regions of one file) and means an agent working `FEAT-734` reads exactly one small file, not one file with 999 other plans in it.

**Metadata format: YAML frontmatter instead of `**Field:** value` lines.** The current format mixes typed metadata (`Status`, `Kind`, `Id`, `Tags`, dates) with prose (description, phases, log) inside one ad-hoc line-based grammar — workable at 26 entries, but it's exactly the kind of format that gets more error-prone to hand-parse as volume grows. Move the typed fields into a `---`-delimited YAML frontmatter block at the top of each file (same pattern Jekyll/Hugo/Obsidian/Astro use for "structured fields + free prose, one file per record"), parsed with a real YAML parser feeding straight into the existing zod schemas (`core/schemas.ts`) instead of a hand-rolled line grammar. The markdown body below frontmatter stays exactly as today — phases as a `- [ ]`/`- [x]` checklist (already about as unambiguous as text gets, no reason to touch it), description and log as prose.

**Spec stays generated, not hand-duplicated.** Today the field list is documented twice — in `about.md`'s prose and in the zod schemas — which is exactly the kind of drift that's easy to miss at 26 entries and likely at 1000. Generate the frontmatter spec from the zod schema (e.g. via `zod-to-json-schema`) so there's one source of truth an agent (or `about.md` itself) can read off directly.

**Fast overview without reopening the bloat problem: a generated index.** A small `papercamp/plans/index.md` (or `.json`) — id, title, status, tags only, no bodies — regenerated on every write, is what the dashboard's list view and an agent's first "what's going on here" pass actually read, instead of either scanning every per-plan file or reintroducing one big file by accident.

**Archiving becomes a file move, not a rewrite.** A plan moving to `done`/`dropped` just moves from `papercamp/plans/` to `papercamp/plans/archive/` (or similar) — no parse-and-re-serialize step, unlike the earlier "cut from one file, append to another" version of this idea. `progress.md` and `decisions.md` are explicitly **not** part of this change — they're read as a timeline/decision log, not scanned for current state, so the bloat argument doesn't apply to them the same way.

**This is a real migration, not a config flag.** `core/parser.ts`/`schemas.ts`/`serializer.ts` need to operate on a directory of frontmatter files instead of one line-parsed file; every CLI command (`init`, `add plan`) and dashboard API route that currently reads/writes `plans.md`/`ideas.md` whole needs updating to the new per-file model; and existing content needs a one-time migration script splitting the current monolithic files into the new layout.

**Why drop `.paper-camp/` rather than move everything under it.** Today there are two top-level folders — `papercamp/` ("the project's memory, versioned, human + AI readable" per `about.md`) and `.paper-camp/` ("local config, not the memory": `config.json` + icon assets) — which is its own source of confusion. `about.md`'s own framing is that the memory content is meant to be opened and read directly; folding it behind a dotfolder convention (the same one `.git/`/`.vscode/` use, which most editors and file browsers collapse by default) works against that on purpose-built content, for no real gain since the config/icon data isn't sensitive enough to need hiding. Hence config/assets move *into* the visible `papercamp/`, not the other way around.

**Open questions, not yet decided:**
- **Filename convention** — pure id (`feat-17.md`) or id+slug (`feat-17-agent-drafted-plans.md`)? The former is stable across renames; the latter is more readable in a plain directory listing.
- **Does `ideas.md` actually need this yet?** It's smaller and grows slower than `plans.md` — worth confirming the same threshold problem actually applies before migrating it on the same timeline rather than assuming parity.
- **Should the generated index double as [[IDEA-1]]'s planned full-text search index** (decisions/open-questions/progress/repo docs search), or are these two different "index" concepts that happen to share a name?
