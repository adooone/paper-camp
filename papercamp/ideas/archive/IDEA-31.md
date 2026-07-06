---
id: IDEA-31
title: Paper Camp MCP server
type: feat
status: done
created: 2026-07-01
updated: 2026-07-03
tags:
  - mcp
  - server
  - core
  - integration
---

The Paper Camp MCP server: read and write tools over papercamp/ exposed through stdio for any MCP client, with the same guards as the dashboard API.

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
