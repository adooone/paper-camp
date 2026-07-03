---
id: FEAT-32
title: Paper Camp MCP server
kind: feat
status: review
created: 2026-07-01
idea: IDEA-31
updated: 2026-07-03
tags:
  - mcp
  - server
  - core
  - integration
---

Expose Paper Camp as a Model Context Protocol server so any MCP client — Claude Code, Claude Desktop, Cursor — can read and write the `papercamp/` project through a standardized interface instead of raw file access. This positions Paper Camp as assistant-agnostic infrastructure rather than a single-tool plugin, and it is a thin wrapper: the whole read/write layer already lives in `src/core` (`readAllPlanFiles`/`readPlansMerged`/`readIdeasMerged` in readers.ts, `parsePlanFile` and the progress/decisions/open-questions parsers in parser.ts, `formatPlanFile`/`assignPlanId`/`archivePlanFile` in serializer.ts) and is already shared by the dashboard's server route modules (`src/app/server/routes/`) and the CLI. The server maps MCP tools one-to-one onto those same functions.

The v1 tool set ships read and write together — `list_plans`, `get_plan`, `update_phase`, `add_idea`, `draft_plan`, `append_progress`, `list_open_questions`, `resolve_open_question`, `list_decisions` — with no read-only-first phasing, because the writes are the point: an assistant that can only read can't keep the project current. Write safety is settled and non-negotiable: every write goes through the `src/core` serializers (never raw edits) so id allocation, archive-on-done, and index regeneration all still hold, and the server enforces the same workflow guards the dashboard does — writes that start or advance a plan run `checkBranchConflictForPlan` server-side so an MCP client can't bypass the "one active plan per branch" rule. Distribution is a `paper-camp mcp` subcommand that runs a stdio server, reusing the installed package so registering it in a client is one config line. This is the better long-term foundation than the Claude Code native surfaces in [[FEAT-31]] — that skill can read through this server rather than reimplementing file access.

### Phases
- [x] Add the MCP SDK and `paper-camp mcp` entry point
      Add the MCP SDK dependency and a new server entry module (e.g. `src/mcp/server.ts`) that instantiates an MCP server over a stdio transport. Wire a `paper-camp mcp` subcommand into the CLI dispatcher that boots this server against the current working directory's `papercamp/` project — reusing the same project-root resolution the CLI and dashboard already use, no new config.
- [x] Map the read tools onto core readers
      Register `list_plans`, `get_plan`, `list_open_questions`, and `list_decisions` as MCP tools whose handlers call the existing `readAllPlanFiles`/`readPlansMerged`/`parsePlanFile` and the open-questions/decisions parsers. Define input/output JSON schemas that mirror the shapes the dashboard API returns so clients see the same data.
- [x] Map the write tools through the guarded core
      Register `update_phase`, `add_idea`, `draft_plan`, `append_progress`, and `resolve_open_question`, each routed through the `src/core` serializers (`formatPlanFile`, `assignPlanId`, `archivePlanFile`) exactly as the dashboard's route handlers in `src/app/server/routes/plans.ts`/`ideas.ts`/`docs.ts` do — never raw file writes — so id allocation, archive-on-done, and index regeneration (`regenerateIndexes` in `src/app/server/helpers.ts`) hold identically. For `append_progress`, note the append logic (`prependProgressItem`) currently lives in `src/app/server/agent-hooks.ts`, not core — move it into `src/core/serializer.ts` next to `formatProgressEntry` so the dashboard hooks and this server share one implementation instead of duplicating the grammar.
- [x] Enforce the branch-conflict guard on plan-advancing writes
      In the `draft_plan` / `update_phase` handlers (the writes that start or advance a plan), call `checkBranchConflictForPlan` server-side before mutating, and return a structured MCP error when it fails — so an MCP client is exactly as constrained as the dashboard and can't create a second active plan on a branch. The guard lives in `src/app/server/helpers.ts` and needs a `GitManager` (`createGitManager` in `src/app/server/git.ts`, constructed with `{ watch: false }` since a stdio server has no SSE subscribers); the CLI already imports app/server modules (`resolveAgent`), so the MCP entry point reusing both is established practice, not a layering violation.
- [x] Tests for the tool handlers and guard enforcement
      Add tests covering each tool's happy path against a fixture `papercamp/` project (reads return expected shapes; writes land through the serializers with correct id allocation and index regen) and covering the guard: a plan-advancing write on a conflicting branch is rejected, matching the dashboard's behavior.
- [x] Document registration and the MCP surface
      Document the `paper-camp mcp` subcommand, the one-line client MCP config snippet, and the v1 tool list with each tool's arguments, so a user can register the server in any client and know what it exposes.
