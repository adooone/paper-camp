---
id: IDEA-2
title: Settings page and configs
---

## IDEA-2: Settings page and configs

Turn Settings from a single static info+icon page into a real sidebar-driven configuration workspace — but scoped honestly to what *this* repo's stack actually has, not a generic eslint/prettier list. The existing project-info card (name, version, icon — already built) becomes the sidebar's default "General" section rather than the whole page.

**Shipped (FEAT-5), confirmed against the current code:**

- **Sidebar layout** — `settings-sidebar.tsx` mirrors `PlansSidebar`'s structure: a left rail of sections (`General`, `Config Files`), main area showing whichever one is selected. "General" is the default landing section.
- **Auto-discovered config sections, not a hardcoded list** — `GET /api/configs` (`src/app/server/api.ts`) checks a fixed candidate list (`biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`) against what actually exists in the repo root and returns only the hits — the sidebar never shows a config this repo doesn't have.

**Also shipped (FEAT-9):**

- **Structured rendering for `package.json`** — `ConfigEditorSection` special-cases it into a `name → command` table instead of a raw `CodeBlock`; every other allowlisted config still renders as `CodeBlock`.
- **Editable project identity** — the "General" card's project name is now an editable `Input`, saved through `POST /api/config`.

This idea is fully shipped — no open items remain.

**Scope change (2026-06-25): the write path for `biome.json`/`tsconfig.json`/etc. is dropped, not deferred.** The original plan for the remaining half was a `Textarea` + JSON-validate + allowlisted save endpoint over these files directly. On reflection that solves a problem nobody has — they're real editor/LSP-backed files; a save button in a browser textarea is strictly worse than the editor already open in another window, for the exact same edit. What's actually worth making *editable* through this dashboard is a small, curated set of operational settings common to most repos (dev server port, env vars) — split out into [[IDEA-13]] rather than bolted onto this idea's original "make every config writable" framing.
