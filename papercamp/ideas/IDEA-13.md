---
id: IDEA-13
title: Project settings — port & env vars
---

## IDEA-13: Project settings — port & env vars

Replaces the "editable raw contents" ambition [[IDEA-2]] originally had for `biome.json`/`tsconfig.json`/etc. Those are real editor/LSP-backed files — a write path over them adds nothing. What's actually worth editing through this dashboard is the small set of operational knobs that are genuinely common across most repos, not specific to this stack: which port the dev server binds to, and which env vars are set.

This repo's own state makes the gap concrete. The port `3333` is hardcoded in three separate places with nothing tying them together: `package.json`'s `dev` script (`--port 3333`), `vite.app.config.ts`'s `server.port`, and the default on `src/cli/index.ts:41`'s `-p, --port` CLI flag for the published `paper-camp dev` command. None of them are visible in the dashboard, and there's no single place that's the source of truth. Env vars are the opposite problem: this repo has no `.env` file at all today, despite that being the single most universal mechanism across JS projects for exactly this kind of config — the feature needs to ship generic, not against a file that happens to exist here.

**Port:**

- New optional `port?: number` field on `PaperCampConfig` (`src/types/index.ts:85-90`), alongside the existing `version`/`projectName`/`initializedAt`/`nextId`.
- A number `Input` in the Settings "General" section, saved through a new `POST /api/config` — this endpoint doesn't exist yet (`GET /api/config` at `src/app/server/api.ts:100-105` is read-only); building it once also closes `IDEA-2`'s still-open "editable project name" item, since both are just different fields on the same `.paper-camp/config.json`.
- **Honest framing, stated in the UI itself**: this sets the default for the *next* launch, not a live port switch on the server that's currently running — same as changing `--port` on a CLI invocation. Nothing about editing this field should imply the dashboard you're looking at right now will hop ports.
- Stretch, not required for v1: wire `src/cli/index.ts:41`'s default to read this value (falling back to `3333` only if unset), so the config field is an actual source of truth instead of a number nothing downstream consumes.

**Env vars:**

- A new `GET`/`POST /api/env` pair, reading/writing the project root's `.env` file directly — not folded into `.paper-camp/config.json`, since `.env` is the format the rest of the ecosystem (including this repo's own Vite setup, if it ever needs one) already expects.
- Parse into `{ key, value }[]`, rendered as a table. Values whose key matches `KEY`/`SECRET`/`TOKEN`/`PASSWORD` (best-effort substring match, not a security boundary) render masked by default with a click-to-reveal; everything else renders plain.
- Add/edit/delete rows; write back as a normal `KEY=value` file, preserving comment lines and the ordering of every line not touched — a one-field edit shouldn't reformat the whole file.
- **The actual highest-value piece**: if a `.env.example` exists, diff its keys against `.env` and flag any present in the example but missing from the real file. "Which env var did I forget to set after pulling" is the recurring problem this solves — editing a value that's already there without opening a text file is a much smaller win by comparison.
- Auto-discovery, same rule the existing `GET /api/configs` list already follows (`api.ts:119-137`) — the section simply doesn't render when neither `.env` nor `.env.example` exists, same as a tool config that isn't present today.

**Where it lives**: a new section in the Settings sidebar, separate from the existing read-only "Config Files" section — these are knobs paper-camp itself manages, not a viewer over someone else's tool config.

**Decisions worth making explicit:**

- **Write paths stay allowlisted and explicit, same principle as every other write path in this codebase** (the Commit section's explicit-files-only `git add`, the existing config-name allowlist) — `/api/env` and `/api/config` only ever touch their one fixed file each, never an arbitrary path from the request.
- **Masking env values is a UX nicety, not a security control.** The dev server has no auth and is already assumed localhost-only everywhere else in this file; this doesn't change that boundary, it just avoids splashing a secret across the screen by default.
- **Not a generalized "config editor."** This idea exists because port and env vars are the actual instances of "config most repos need to change" — it's deliberately not a reusable framework for editing arbitrary files, which is exactly the scope `IDEA-2`'s original write-path ambition overreached into.
