---
id: IDEA-31
title: Paper Camp as an MCP server
---

## IDEA-31: Paper Camp as an MCP server

Expose Paper Camp as a Model Context Protocol server, alongside the CLI and dashboard. Instead of an assistant reading/writing `papercamp/` via raw file access, it gets a standardized MCP interface. This positions Paper Camp as **assistant-agnostic infrastructure** — usable from any MCP client (Claude Code, Claude Desktop, Cursor, …), not a single-tool plugin.

**Why it's a thin wrapper, not a rewrite:** the whole read/write layer already exists in `src/core` — `readAllPlanFiles`/`readPlansMerged`/`readIdeasMerged`/`parsePlanFile`/`formatPlanFile`/`assignPlanId`/`archivePlanFile`, plus the progress/decisions/open-questions parsers. The server maps MCP tools onto those functions — the same core `api.ts` (dashboard) and the CLI already call.

**v1 tool set (read + write, all shipped together):** `list_plans`, `get_plan`, `update_phase`, `add_idea`, `draft_plan`, `append_progress`, `list_open_questions`, `resolve_open_question`, `list_decisions` — mirroring the existing API routes one-to-one. Decision: **no read-only-first phasing** — the writes are the point (an assistant that can only read can't keep the project current), and they're safe because they go through the core (below).

**Write safety (settled):** every write tool goes through the `src/core` serializers, never raw file edits — so id allocation, archive-on-done, and index regeneration all still hold. And the server **enforces the same workflow guards the dashboard does**: writes that start/advance a plan run `checkBranchConflictForPlan` server-side, so an MCP client can't bypass the "one active plan per branch" rule that the UI enforces. The MCP surface is exactly as safe as the dashboard because it shares the same guarded core paths.

**Distribution:** ship as a `paper-camp mcp` subcommand that runs a stdio MCP server, so registering it in any client's MCP config is one line. Reuses the installed package — no separate service to deploy.

**Relationship to [[IDEA-30]]:** MCP is broad cross-assistant compatibility; the Claude Code skill/hooks are deep native UX. They compose — the skill can sit on top of this server rather than reimplementing file access, so the MCP server is the better long-term foundation of the two.

Effort is real (new server entry point + MCP SDK wiring + tool schemas + tests), so this is its own plan — but the core reuse and the settled decisions above keep it bounded.
