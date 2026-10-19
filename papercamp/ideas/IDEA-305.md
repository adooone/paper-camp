---
id: IDEA-305
title: MCP in every agent run
type: fix
status: review
created: 2026-10-19
tags:
  - server
  - agents
  - mcp
  - cli
subject: Infrastructure
---

Runs launched by Paper Camp never see the `paper-camp` MCP server. The
claude-code adapter (`src/app/server/agents/claude-code.ts`) passes
`--strict-mcp-config` and no `--mcp-config`; the CLI's own help defines that
flag as "only use MCP servers from --mcp-config", so every phase, fix, draft,
reconcile and review run starts with zero servers. The opencode adapter passes
nothing MCP-related and opencode has no per-run flag at all. Nothing registers
the server for interactive sessions either: `paper-camp init` scaffolds the
skill and `.claude/settings.json` but no `.mcp.json`, and `docs/MCP.md` tells
people to hand-write an entry with a `cwd` field that Claude Code's `.mcp.json`
does not have. The scaffolded `SKILL.md` says "if a papercamp MCP server is
connected, prefer its tools", a condition that is only ever true in a session
someone configured by hand. That is the "sometimes".

**Headless claude-code runs carry the server inline.** `buildArgs` appends
`--mcp-config` with the inline JSON string
`{"mcpServers":{"paper-camp":{"command":"paper-camp","args":["mcp"]}}}` and
keeps `--strict-mcp-config`, so the run gets exactly one MCP server and the
ambient browser and computer-use servers stay out. `paper-camp` is the globally
installed binary; the server runs in the agent's working directory, which is
the project root. Read-only prompts (`runReadOnlyPrompt` in `agent.ts`) build
their own flags and get no server: they never write the corpus. The adapter
test asserts both flags and the JSON.

**Init writes the project files.** `runInit` and `runInit --settings` write
`.mcp.json` at the project root with the same `paper-camp` entry, merging into
an existing file without touching other servers. They also merge
`mcp.paper-camp = { "type": "local", "command": ["paper-camp", "mcp"],
"enabled": true }` into `opencode.json` at the project root, creating the file
when absent, so opencode runs (headless and interactive) pick it up from the
project config. Both writes are idempotent. The scaffold test covers create and
merge for each file.

**Doctor and docs say so.** `paper-camp doctor` gets a tooling check that
warns when `.mcp.json` or `opencode.json` lacks the `paper-camp` entry, with
the fix pointing at `paper-camp init --settings`. `docs/MCP.md` drops the `cwd`
field and the branch-guard claim, and shows the two scaffolded files. The
`SKILL.md` template and this repo's `.claude/skills/paper-camp/SKILL.md` state
that the server is present in every run Paper Camp launches and in every
session opened in an initialised project, instead of "if connected".

Until IDEA-307 lands, a write the MCP server makes during a run reaches the
dashboard on its next fetch (the mtime fingerprint), not as a live tick.

Done when a phase run's stream-json `init` event lists `paper-camp` under its
MCP servers, a fresh `paper-camp init` in a scratch repo produces both config
files, and `paper-camp doctor` is green on this repo.

### Phases
- [x] Pass the MCP server to headless claude-code runs
      `buildArgs` appends `--mcp-config` with the inline JSON and keeps
      `--strict-mcp-config`; `claude-code.test.ts` asserts the exact args.
      run: 52s · 22 in · 2.3k out · sonnet-5 · sess:0e49ae85-99f2-4b7f-b319-006b47b83c98
- [x] Scaffold `.mcp.json` and `opencode.json` from init
      `runInit` and `--settings` write or merge the `paper-camp` entry in both
      files, idempotently; scaffold tests for create and merge.
      run: 2m6s · 46 in · 8.4k out · sonnet-5 · sess:0e49ae85-99f2-4b7f-b319-006b47b83c98
- [x] Doctor check, docs and skill wording
      Tooling check for the two entries; `docs/MCP.md` corrected; the
      `SKILL.md` template and this repo's skill drop the "if connected" hedge.
      run: 4m1s · 82 in · 15.7k out · sonnet-5 · sess:0e49ae85-99f2-4b7f-b319-006b47b83c98
