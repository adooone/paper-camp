---
id: IDEA-13
title: Project settings and config views
type: feat
status: done
created: 2026-06-21
updated: 2026-06-25
tags:
  - app
  - settings
---

Revised Settings scope: rendered package.json scripts as a table and added project port/env settings instead of a raw config-file write path nobody needed.

### Phases
- [x] Render package.json scripts as a table
      `ConfigEditorSection` special-cases `package.json`: parse its `scripts` block into `name → command` rows instead of dumping the whole file through `CodeBlock`; every other allowlisted config stays exactly as today
- [x] Add `port` to PaperCampConfig and POST /api/config
      New optional `port?: number` field; a number `Input` in Settings "General", saved through a new `POST /api/config` (doesn't exist yet — `GET /api/config` is read-only). State in the UI that this sets the default for the next launch, not a live switch on the running server
- [x] Make project name editable
      The "General" card's project name becomes an editable `Input`, writing back through the same new `POST /api/config` as the port field
- [x] Add GET/POST /api/env and env table
      Reads/writes the project root's `.env`; table UI with masked values for `KEY`/`SECRET`/`TOKEN`/`PASSWORD`-like keys, add/edit/delete rows, preserving comments and ordering of untouched lines; section doesn't render when no `.env`/`.env.example` exists
- [x] Diff against .env.example
      Flag keys present in `.env.example` but missing from `.env` — the actual highest-value piece of the env-var work

### Log
- 2026-06-25: Reviewed and checked off phases 2–5 (built across several agent-launched sessions, not previously reflected here). `POST /api/config` saves `port`/`projectName`/`defaultAgent` onto `.paper-camp/config.json` with validation; Settings "General" gained matching `Input`/`Select` fields with save-confirmation. `src/core/env.ts` parses/serializes `.env` preserving comments and untouched line order; `GET`/`POST /api/env` and a new `EnvSection` (masked values for key/secret/token/password-like keys, add/edit/delete rows) only render in the sidebar when `.env` or `.env.example` exists — confirmed live via a temporary `.env.example` that `missingKeys` correctly reports unset keys with one-click add buttons. `tsc`/`biome` clean across all touched files. All phases done — Status set to `review` per `AGENTS.md`.
